import { NextRequest, NextResponse } from 'next/server';
import { getProject, sourceUrl } from '@/lib/projects';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json({ project, sourceUrl: sourceUrl(project) });
}
