import { NextResponse } from 'next/server';
import { getProject, listProjectIds } from '@/lib/projects';

export const runtime = 'nodejs';
// Runtime-only: this reads R2 (and validates env) per request. Never prerender
// it at build time — secrets aren't present during `next build`, and static
// generation would fail with "Invalid / missing environment variables".
export const dynamic = 'force-dynamic';

/** List projects (most recent first). Phase 0 uses a small R2-backed index. */
export async function GET() {
  const ids = await listProjectIds();
  const projects = (await Promise.all(ids.slice(0, 50).map((id) => getProject(id)))).filter(
    Boolean,
  );
  return NextResponse.json({ projects });
}
