import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { presignPut } from '@/lib/r2';
import { newId, safeFilename } from '@/lib/ids';
import { saveProject, sourceKeyFor, type Project } from '@/lib/projects';

export const runtime = 'nodejs';

const Body = z.object({
  filename: z.string().min(1).max(255),
  contentType: z
    .string()
    .regex(/^video\//, 'contentType must be a video/* MIME type'),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { filename, contentType } = parsed.data;

  try {
    const id = newId('p_');
    const cleanName = safeFilename(filename);
    const sourceKey = sourceKeyFor(id, cleanName);

    const now = new Date().toISOString();
    const project: Project = {
      id,
      filename: cleanName,
      contentType,
      sourceKey,
      status: 'uploading',
      createdAt: now,
      updatedAt: now,
    };
    await saveProject(project);

    const uploadUrl = await presignPut(sourceKey, contentType);

    return NextResponse.json({ projectId: id, sourceKey, uploadUrl });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create upload', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
