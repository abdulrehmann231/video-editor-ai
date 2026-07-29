import { NextRequest, NextResponse } from 'next/server';
import { finalUrl, getProject, shortsUrl } from '@/lib/projects';
import { runFinalRender } from '@/lib/pipeline/steps';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * Composite motion graphics over the cut and store the final video. Thin wrapper
 * over runFinalRender. `?format=shorts` renders a 9:16 version.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.media) return NextResponse.json({ error: 'Not ingested yet.' }, { status: 409 });
  if (!project.edl) return NextResponse.json({ error: 'Run analysis first.' }, { status: 409 });

  const format = new URL(req.url).searchParams.get('format') === 'shorts' ? 'shorts' : 'landscape';
  const inProgress = format === 'shorts' ? project.shortsStatus === 'rendering' : project.finalStatus === 'rendering';
  if (inProgress) {
    return NextResponse.json({ error: 'Render already in progress' }, { status: 409 });
  }

  try {
    const { project: saved, warnings } = await runFinalRender(params.id, { format });
    return NextResponse.json({
      project: saved,
      finalUrl: finalUrl(saved),
      shortsUrl: shortsUrl(saved),
      meta: format === 'shorts' ? saved.shortsMeta : saved.finalMeta,
      warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Final render failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
