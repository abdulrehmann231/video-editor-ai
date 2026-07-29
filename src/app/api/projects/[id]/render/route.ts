import { NextRequest, NextResponse } from 'next/server';
import { getProject, renderUrl, saveProject } from '@/lib/projects';
import { renderCut } from '@/lib/render/renderCut';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Phase 2: render the structural cut (silence removal + audio normalize) from
 * the project's EDL and store it in R2.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!project.media) {
    return NextResponse.json({ error: 'Project is not ingested yet.' }, { status: 409 });
  }
  if (!project.edl) {
    return NextResponse.json(
      { error: 'No edit plan yet — run analysis first.' },
      { status: 409 },
    );
  }
  if (project.renderStatus === 'rendering') {
    return NextResponse.json({ error: 'Render already in progress' }, { status: 409 });
  }

  await saveProject({ ...project, renderStatus: 'rendering', renderError: undefined });

  try {
    const result = await renderCut({
      projectId: project.id,
      sourceKey: project.sourceKey,
      filename: project.filename,
      media: project.media,
      edl: project.edl,
    });

    const saved = await saveProject({
      ...project,
      renderStatus: 'rendered',
      renderError: undefined,
      renderKey: result.renderKey,
      renderMeta: result.meta,
    });

    return NextResponse.json({
      project: saved,
      renderUrl: renderUrl(saved),
      meta: result.meta,
    });
  } catch (err) {
    const saved = await saveProject({
      ...project,
      renderStatus: 'error',
      renderError: (err as Error).message,
    });
    return NextResponse.json(
      { error: 'Render failed', detail: saved.renderError },
      { status: 500 },
    );
  }
}
