import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { startPipeline } from '@/lib/pipeline/pipeline';

export const runtime = 'nodejs';

/**
 * Kick the fully-automatic pipeline (analyze → cut → final render). Returns
 * immediately (202); the client polls GET /api/projects/:id for progress.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.media) {
    return NextResponse.json({ error: 'Project is not ingested yet.' }, { status: 409 });
  }

  let prompt: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.prompt === 'string') prompt = body.prompt.trim();
  } catch {
    /* no body */
  }

  try {
    await startPipeline(params.id, { prompt });
    return NextResponse.json({ ok: true, status: 'running' }, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to start pipeline', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
