import { NextRequest, NextResponse } from 'next/server';
import { finalUrl, getProject, saveProject, type Project } from '@/lib/projects';
import { renderCut } from '@/lib/render/renderCut';
import { renderFinal } from '@/lib/render/renderFinal';
import { buildOverlayPlan } from '@/lib/render/timeline';
import { resolveBroll } from '@/lib/render/resolveBroll';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * Phase 3: composite motion graphics (captions/zooms/lower-thirds/b-roll) over
 * the cut and store the final video. Ensures a cut exists first.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  let project = await getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.media) return NextResponse.json({ error: 'Not ingested yet.' }, { status: 409 });
  if (!project.edl) return NextResponse.json({ error: 'Run analysis first.' }, { status: 409 });
  if (project.finalStatus === 'rendering') {
    return NextResponse.json({ error: 'Final render already in progress' }, { status: 409 });
  }

  await saveProject({ ...project, finalStatus: 'rendering', finalError: undefined });

  const media = project.media;
  const edl = project.edl; // captured before reassignment below
  const sourceDuration = media.durationSec ?? 0;

  try {
    // 1. Always render a FRESH cut so we composite on a base consistent with the
    //    current EDL (cheap; avoids stale-cut bugs after re-analysis).
    const cut = await renderCut({
      projectId: project.id,
      sourceKey: project.sourceKey,
      filename: project.filename,
      media,
      edl,
    });
    project = await saveProject({
      ...project,
      renderStatus: 'rendered',
      renderKey: cut.renderKey,
      renderMeta: cut.meta,
    });
    const cutUrl = cut.url;

    // 2. Build overlay plan (source→cut timeline remap) and resolve b-roll.
    const plan = buildOverlayPlan(edl, project.transcript ?? [], sourceDuration);
    const { resolved, warnings } = await resolveBroll(plan.brolls, {
      orientation: (media.width ?? 16) >= (media.height ?? 9) ? 'landscape' : 'portrait',
    });
    plan.brolls = resolved;

    // 3. Composite with Remotion.
    const result = await renderFinal({
      projectId: project.id,
      cutUrl,
      width: media.width ?? 1280,
      height: media.height ?? 720,
      fps: media.fps ?? 30,
      plan,
    });

    const saved = await saveProject({
      ...project,
      finalStatus: 'rendered',
      finalError: undefined,
      finalKey: result.finalKey,
      finalMeta: result.meta,
      finalWarnings: warnings,
    });

    return NextResponse.json({ project: saved, finalUrl: finalUrl(saved), meta: result.meta, warnings });
  } catch (err) {
    const saved: Project = await saveProject({
      ...project,
      finalStatus: 'error',
      finalError: (err as Error).message,
    });
    return NextResponse.json({ error: 'Final render failed', detail: saved.finalError }, { status: 500 });
  }
}
