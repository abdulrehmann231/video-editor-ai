import { searchVideos, pickBestFile, type Orientation } from '../pexels';
import type { BrollOverlay } from './timeline';

/**
 * Resolve each b-roll overlay's `query` to a concrete Pexels clip URL.
 * Best-effort and independent: a failed/empty lookup leaves `src` undefined so
 * the render simply skips that overlay (logged by the caller).
 */
export async function resolveBroll(
  brolls: BrollOverlay[],
  opts: { orientation?: Orientation; maxWidth?: number } = {},
): Promise<{ resolved: BrollOverlay[]; warnings: string[] }> {
  const orientation = opts.orientation ?? 'landscape';
  const maxWidth = opts.maxWidth ?? 1920;
  const warnings: string[] = [];

  const resolved = await Promise.all(
    brolls.map(async (b) => {
      try {
        const res = await searchVideos(b.query, { perPage: 5, orientation });
        const video = res.videos[0];
        const file = video ? pickBestFile(video, { orientation, maxWidth }) : null;
        if (!file) {
          warnings.push(`No b-roll found for "${b.query}"`);
          return b;
        }
        return { ...b, src: file.link };
      } catch (err) {
        warnings.push(`B-roll lookup failed for "${b.query}": ${(err as Error).message}`);
        return b;
      }
    }),
  );

  return { resolved, warnings };
}
