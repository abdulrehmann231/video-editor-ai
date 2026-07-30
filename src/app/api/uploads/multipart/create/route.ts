import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { newId, safeFilename } from '@/lib/ids';
import { saveProject, sourceKeyFor, type Project } from '@/lib/projects';
import { createMultipart } from '@/lib/uploads/multipart';
import { planParts } from '@/lib/uploads/partPlan';

export const runtime = 'nodejs';

const Body = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^video\//, 'contentType must be a video/* MIME type'),
  size: z.number().int().positive(),
  prompt: z.string().max(2000).optional(),
});

/** Begin a resumable multipart upload; returns the plan + uploadId. */
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const { filename, contentType, size, prompt } = parsed.data;

  try {
    const id = newId('p_');
    const cleanName = safeFilename(filename);
    const sourceKey = sourceKeyFor(id, cleanName);
    const uploadId = await createMultipart(sourceKey, contentType);
    const { partSize, partCount } = planParts(size);

    const now = new Date().toISOString();
    const project: Project = {
      id,
      filename: cleanName,
      contentType,
      sourceKey,
      status: 'uploading',
      createdAt: now,
      updatedAt: now,
      prompt: prompt?.trim() || undefined,
      multipartUploadId: uploadId,
    };
    await saveProject(project);

    return NextResponse.json({ projectId: id, sourceKey, uploadId, partSize, partCount });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to start upload', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
