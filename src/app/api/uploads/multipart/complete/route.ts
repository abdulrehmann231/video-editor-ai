import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProject, saveProject } from '@/lib/projects';
import { completeMultipart } from '@/lib/uploads/multipart';

export const runtime = 'nodejs';

const Body = z.object({
  projectId: z.string().min(1),
  parts: z
    .array(z.object({ PartNumber: z.number().int().min(1), ETag: z.string().min(1) }))
    .min(1),
});

/** Finalize the multipart upload; the object becomes readable in R2. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }
  const { projectId, parts } = parsed.data;

  const project = await getProject(projectId);
  if (!project || !project.multipartUploadId) {
    return NextResponse.json({ error: 'No active upload for this project' }, { status: 404 });
  }

  try {
    await completeMultipart(project.sourceKey, project.multipartUploadId, parts);
    const saved = await saveProject({ ...project, status: 'uploaded', multipartUploadId: undefined });
    return NextResponse.json({ ok: true, projectId: saved.id });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to complete upload', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
