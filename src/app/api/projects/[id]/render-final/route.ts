import { NextRequest, NextResponse } from 'next/server';
import { finalUrl, getProject } from '@/lib/projects';
import { runFinalRender } from '@/lib/pipeline/steps';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * Phase 3: composite motion graphics (captions/zooms/lower-thirds/b-roll) over
 * the cut and store the final video. Thin wrapper over runFinalRender.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.media) return NextResponse.json({ error: 'Not ingested yet.' }, { status: 409 });
  if (!project.edl) return NextResponse.json({ error: 'Run analysis first.' }, { status: 409 });
  if (project.finalStatus === 'rendering') {
    return NextResponse.json({ error: 'Final render already in progress' }, { status: 409 });
  }

  try {
    const { project: saved, warnings } = await runFinalRender(params.id);
    return NextResponse.json({
      project: saved,
      finalUrl: finalUrl(saved),
      meta: saved.finalMeta,
      warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Final render failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
