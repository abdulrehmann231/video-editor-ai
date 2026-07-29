import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { runAnalyze } from '@/lib/pipeline/steps';

export const runtime = 'nodejs';
// Analysis (download + silence + whisper + Gemini File API) is slow.
export const maxDuration = 300;

/**
 * Run the editorial analysis for a project and store the resulting EDL +
 * decision log. Thin wrapper over the shared runAnalyze step.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.media) {
    return NextResponse.json({ error: 'Project is not ingested yet.' }, { status: 409 });
  }
  if (project.analysisStatus === 'analyzing') {
    return NextResponse.json({ error: 'Analysis already in progress' }, { status: 409 });
  }

  const url = new URL(req.url);
  const noTranscribe = url.searchParams.get('transcribe') === '0';

  // Allow a re-run to update the steering prompt.
  let promptOverride: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.prompt === 'string') promptOverride = body.prompt.trim();
  } catch {
    /* no body — fine */
  }

  try {
    const saved = await runAnalyze(params.id, {
      prompt: promptOverride,
      transcribe: !noTranscribe,
    });
    return NextResponse.json({
      project: saved,
      opCount: saved.edl?.ops.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Analysis failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
