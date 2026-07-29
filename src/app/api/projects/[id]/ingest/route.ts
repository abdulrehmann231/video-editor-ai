import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/projects';
import { objectExists, presignGet } from '@/lib/r2';
import { probeMedia } from '@/lib/ingest';
import { startPipeline } from '@/lib/pipeline/pipeline';

export const runtime = 'nodejs';
// ffprobe on a large remote file can take a while.
export const maxDuration = 120;

/**
 * Call after the browser has PUT the file to R2. Confirms the object exists,
 * runs ffprobe on a presigned URL, and stores the media info on the project.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  const autostart = new URL(req.url).searchParams.get('autostart') !== '0';

  try {
    const exists = await objectExists(project.sourceKey);
    if (!exists) {
      const updated = await saveProject({
        ...project,
        status: 'error',
        error: 'Source object not found in R2 — upload may not have completed.',
      });
      return NextResponse.json({ error: updated.error }, { status: 409 });
    }

    await saveProject({ ...project, status: 'uploaded' });

    const url = await presignGet(project.sourceKey, 1800);
    const media = await probeMedia(url);

    const ingested = await saveProject({
      ...project,
      status: 'ingested',
      media,
      error: undefined,
    });

    // Fully-automatic: kick the analyze → cut → final pipeline right away.
    if (autostart) {
      await startPipeline(ingested.id).catch(() => {
        /* status recorded on the project; client polls */
      });
    }

    return NextResponse.json({ project: ingested, autostarted: autostart });
  } catch (err) {
    const updated = await saveProject({
      ...project,
      status: 'error',
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: 'Ingest failed', detail: updated.error },
      { status: 500 },
    );
  }
}
