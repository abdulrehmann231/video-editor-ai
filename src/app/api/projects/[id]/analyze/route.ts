import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/projects';
import { analyzeVideo } from '@/lib/analyze/analyzeVideo';

export const runtime = 'nodejs';
// Analysis (download + silence + whisper + Gemini File API) is slow.
export const maxDuration = 300;

/**
 * Run the editorial analysis for a project and store the resulting EDL +
 * decision log. Idempotent-ish: refuses to start if already analyzing.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!project.media) {
    return NextResponse.json(
      { error: 'Project is not ingested yet — run ingest first.' },
      { status: 409 },
    );
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
  const effectivePrompt = promptOverride !== undefined ? promptOverride : project.prompt;

  await saveProject({
    ...project,
    prompt: effectivePrompt || undefined,
    analysisStatus: 'analyzing',
    analysisError: undefined,
  });

  try {
    const result = await analyzeVideo({
      sourceKey: project.sourceKey,
      contentType: project.contentType,
      filename: project.filename,
      media: project.media,
      userPrompt: effectivePrompt,
      transcribe: !noTranscribe,
    });

    const saved = await saveProject({
      ...project,
      prompt: effectivePrompt || undefined,
      analysisStatus: 'analyzed',
      analysisError: undefined,
      edl: result.edl,
      analysisMeta: result.meta,
      transcript: result.transcript,
    });

    return NextResponse.json({
      project: saved,
      warnings: result.warnings,
      opCount: result.edl.ops.length,
    });
  } catch (err) {
    const saved = await saveProject({
      ...project,
      prompt: effectivePrompt || undefined,
      analysisStatus: 'error',
      analysisError: (err as Error).message,
    });
    return NextResponse.json(
      { error: 'Analysis failed', detail: saved.analysisError },
      { status: 500 },
    );
  }
}
