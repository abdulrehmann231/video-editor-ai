import type { MotionComposition, VideoLayer } from '../ir/types';
import type { BrollOverlay } from '../../render/timeline';
import { resolveBroll as defaultResolve } from '../../render/resolveBroll';
import { normalizeBrollClips as defaultNormalize } from '../../render/normalizeBroll';

/**
 * Resolve b-roll for the Motion (IR) render path: find broll compositions, look
 * up a stock clip for each query (reusing the existing Pexels resolver +
 * fps-normalizer), and inject the resolved `src` into the video layer. Closes the
 * Phase-1.5 gap where b-roll layers had no source.
 *
 * The resolver/normalizer are injectable so this is unit-testable without network.
 */

type Resolver = (brolls: BrollOverlay[], opts: { orientation?: 'landscape' | 'portrait' }) => Promise<{ resolved: BrollOverlay[]; warnings: string[] }>;
type Normalizer = (brolls: BrollOverlay[], fps: number) => Promise<{ brolls: BrollOverlay[]; warnings: string[] }>;

export interface ResolveMotionBrollOpts {
  orientation: 'landscape' | 'portrait';
  fps: number;
  resolve?: Resolver;
  normalize?: Normalizer;
}

/** First video layer in a (broll) composition, if any. */
function findVideoLayer(comp: MotionComposition): VideoLayer | undefined {
  return comp.layers.find((l): l is VideoLayer => l.type === 'video');
}

export async function resolveMotionBroll(
  compositions: MotionComposition[],
  opts: ResolveMotionBrollOpts,
): Promise<{ compositions: MotionComposition[]; warnings: string[] }> {
  const resolve = opts.resolve ?? (defaultResolve as Resolver);
  const normalize = opts.normalize ?? (defaultNormalize as Normalizer);

  // Collect broll compositions that have a video layer + a query.
  const brollComps = compositions.filter((c) => c.metadata?.sourceOpType === 'broll' && findVideoLayer(c));
  if (brollComps.length === 0) return { compositions, warnings: [] };

  const overlays: BrollOverlay[] = brollComps.map((c) => {
    const v = findVideoLayer(c)!;
    return {
      id: c.id,
      start: c.start,
      end: c.end,
      layout: v.fit === 'cover' ? 'full' : 'pip',
      query: c.metadata?.query ?? '',
    };
  });

  const { resolved, warnings: rw } = await resolve(overlays, { orientation: opts.orientation });
  const { brolls: normalized, warnings: nw } = await normalize(resolved, opts.fps);
  const srcById = new Map(normalized.map((b) => [b.id, b.src] as const));

  // Inject src into each broll composition's video layer.
  const out = compositions.map((c) => {
    if (c.metadata?.sourceOpType !== 'broll') return c;
    const src = srcById.get(c.id);
    if (!src) return c; // unresolved -> layer stays srcless (renders nothing)
    return {
      ...c,
      layers: c.layers.map((l) => (l.type === 'video' ? { ...l, src } : l)),
    };
  });

  return { compositions: out, warnings: [...rw, ...nw] };
}
