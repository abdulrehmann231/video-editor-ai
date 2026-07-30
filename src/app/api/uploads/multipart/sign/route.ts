import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProject } from '@/lib/projects';
import { signPart } from '@/lib/uploads/multipart';
import { MAX_PARTS } from '@/lib/uploads/partPlan';

export const runtime = 'nodejs';

const Body = z.object({
  projectId: z.string().min(1),
  partNumber: z.number().int().min(1).max(MAX_PARTS),
});

/** Presign a single part PUT, scoped to the project's own upload. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }
  const { projectId, partNumber } = parsed.data;

  const project = await getProject(projectId);
  if (!project || !project.multipartUploadId) {
    return NextResponse.json({ error: 'No active upload for this project' }, { status: 404 });
  }

  try {
    const url = await signPart(project.sourceKey, project.multipartUploadId, partNumber);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to sign part', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
