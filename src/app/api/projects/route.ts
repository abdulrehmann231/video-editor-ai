import { NextResponse } from 'next/server';
import { getProject, listProjectIds } from '@/lib/projects';

export const runtime = 'nodejs';

/** List projects (most recent first). Phase 0 uses a small R2-backed index. */
export async function GET() {
  const ids = await listProjectIds();
  const projects = (await Promise.all(ids.slice(0, 50).map((id) => getProject(id)))).filter(
    Boolean,
  );
  return NextResponse.json({ projects });
}
