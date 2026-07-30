import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProject, saveProject } from '@/lib/projects';
import { abortMultipart } from '@/lib/uploads/multipart';

export const runtime = 'nodejs';

const Body = z.object({ projectId: z.string().min(1) });

/** Abort an in-flight multipart upload (called on cancel / failure). */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const project = await getProject(parsed.data.projectId);
  if (!project || !project.multipartUploadId) {
    return NextResponse.json({ ok: true }); // nothing to abort
  }
  await abortMultipart(project.sourceKey, project.multipartUploadId);
  await saveProject({ ...project, status: 'error', error: 'Upload aborted', multipartUploadId: undefined });
  return NextResponse.json({ ok: true });
}
