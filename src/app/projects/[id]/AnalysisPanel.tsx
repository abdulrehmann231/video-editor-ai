'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toDecisionLog, type Edl, type AnalysisMeta } from '@/lib/edl/schema';

type Status = 'idle' | 'analyzing' | 'analyzed' | 'error';

const OP_ICON: Record<string, string> = {
  silence_cut: '✂️',
  caption: '💬',
  zoom_punch: '🔍',
  lower_third: '🏷️',
  broll: '🎞️',
};

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AnalysisPanel(props: {
  projectId: string;
  initialStatus: Status;
  initialEdl?: Edl;
  initialMeta?: AnalysisMeta;
  initialError?: string;
  initialPrompt?: string;
}) {
  const [status, setStatus] = useState<Status>(props.initialStatus);
  const [edl, setEdl] = useState<Edl | undefined>(props.initialEdl);
  const [meta, setMeta] = useState<AnalysisMeta | undefined>(props.initialMeta);
  const [error, setError] = useState<string | undefined>(props.initialError);
  const [prompt, setPrompt] = useState(props.initialPrompt ?? '');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    const res = await fetch(`/api/projects/${props.projectId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { project } = await res.json();
    const s: Status = project.analysisStatus ?? 'idle';
    setStatus(s);
    setEdl(project.edl);
    setMeta(project.analysisMeta);
    setError(project.analysisError);
    if (s === 'analyzed' || s === 'error') stopPolling();
  }, [props.projectId]);

  useEffect(() => {
    if (status === 'analyzing' && !pollRef.current) {
      pollRef.current = setInterval(poll, 4000);
    }
    return stopPolling;
  }, [status, poll]);

  const run = useCallback(async () => {
    setStatus('analyzing');
    setError(undefined);
    // Fire the (long-running) analysis; polling reflects completion even if this
    // connection is dropped by a proxy timeout.
    fetch(`/api/projects/${props.projectId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim() }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setError(e.detail || e.error || 'Analysis failed');
        }
        await poll();
      })
      .catch(() => {
        /* rely on polling */
      });
    if (!pollRef.current) pollRef.current = setInterval(poll, 4000);
  }, [props.projectId, poll, prompt]);

  const decisions = edl ? toDecisionLog(edl) : [];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>AI edit plan (EDL)</h2>
        <button
          className="btn"
          onClick={run}
          disabled={status === 'analyzing'}
        >
          {status === 'analyzing'
            ? 'Analyzing…'
            : status === 'analyzed'
            ? 'Re-run analysis'
            : 'Run analysis'}
        </button>
      </div>

      <label htmlFor="edit-prompt" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 14 }}>
        Editing instructions <span className="muted">(optional)</span>
      </label>
      <textarea
        id="edit-prompt"
        className="prompt-input"
        rows={2}
        placeholder="e.g. Keep it fast, caption every sentence, introduce the speaker as “Sara, CEO”, add analytics b-roll."
        value={prompt}
        disabled={status === 'analyzing'}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
        Edit and re-run to steer the plan.
      </p>

      {status === 'analyzing' && (
        <p className="status">
          Watching the video, detecting silence, transcribing, and planning edits… this can
          take a minute or two.
        </p>
      )}
      {status === 'error' && <p className="status error">{error}</p>}

      {edl && (
        <>
          {edl.summary && (
            <p className="muted" style={{ marginTop: 14 }}>
              {edl.summary}
            </p>
          )}
          {meta && (
            <p className="muted mono" style={{ fontSize: 12 }}>
              {edl.ops.length} edits · model {meta.model}
              {meta.transcriptWords ? ` · ${meta.transcriptWords} words` : ''}
              {meta.silenceSegments ? ` · ${meta.silenceSegments} silences` : ''}
              {meta.repaired ? ' · repaired' : ''}
            </p>
          )}

          <div style={{ marginTop: 12 }}>
            {decisions.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 120px 1fr',
                  gap: 10,
                  padding: '8px 0',
                  borderTop: '1px solid var(--border)',
                  alignItems: 'baseline',
                }}
              >
                <span title={d.type}>{OP_ICON[d.type] ?? '•'}</span>
                <span className="mono muted">
                  {fmt(d.start)}–{fmt(d.end)}
                </span>
                <span>
                  <strong style={{ fontSize: 13 }}>{d.type}</strong>
                  <span className="muted"> — {d.reason}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!edl && status !== 'analyzing' && status !== 'error' && (
        <p className="muted">No edit plan yet. Run analysis to generate one.</p>
      )}
    </div>
  );
}
