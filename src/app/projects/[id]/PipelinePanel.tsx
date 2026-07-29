'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toDecisionLog, type Edl } from '@/lib/edl/schema';
import { PIPELINE_STEPS, stepState, type PipelineStatus as PStatus, type PipelineStep as Step } from '@/lib/pipeline/view';

interface ProjectView {
  pipelineStatus?: PStatus;
  pipelineStep?: Step;
  pipelineError?: string;
  analysisStatus?: string;
  finalStatus?: string;
  edl?: Edl;
  finalWarnings?: string[];
}

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

export default function PipelinePanel(props: {
  projectId: string;
  initial: ProjectView;
  initialFinalUrl?: string | null;
}) {
  const [p, setP] = useState<ProjectView>(props.initial);
  const [finalUrl, setFinalUrl] = useState<string | null>(props.initialFinalUrl ?? null);
  const [prompt, setPrompt] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    const res = await fetch(`/api/projects/${props.projectId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setP(data.project);
    if (data.finalUrl) setFinalUrl(data.finalUrl);
    if (data.project.pipelineStatus !== 'running') stop();
  }, [props.projectId]);

  useEffect(() => {
    if (p.pipelineStatus === 'running' && !pollRef.current) {
      pollRef.current = setInterval(poll, 4000);
    }
    return stop;
  }, [p.pipelineStatus, poll]);

  const rerun = useCallback(() => {
    setP((prev) => ({ ...prev, pipelineStatus: 'running', pipelineStep: 'analyze', pipelineError: undefined }));
    fetch(`/api/projects/${props.projectId}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim() }),
    })
      .catch(() => {})
      .finally(() => {
        if (!pollRef.current) pollRef.current = setInterval(poll, 4000);
        poll();
      });
  }, [props.projectId, poll, prompt]);

  const status = p.pipelineStatus ?? 'idle';
  const activeStep = p.pipelineStep ?? 'analyze';
  const decisions = p.edl ? toDecisionLog(p.edl) : [];

  return (
    <div className="card" style={{ borderColor: '#2b3a55' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          {status === 'done'
            ? '✅ Your edited video'
            : status === 'error'
            ? '⚠️ Editing failed'
            : status === 'running'
            ? '⏳ AI is editing your video…'
            : 'AI editor'}
        </h2>
        {status !== 'running' && (
          <button className="btn" onClick={rerun}>
            {status === 'done' ? 'Re-edit' : status === 'error' ? 'Retry' : 'Start editing'}
          </button>
        )}
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 10, margin: '16px 0', flexWrap: 'wrap' }}>
        {PIPELINE_STEPS.map((s) => {
          const st = stepState(status, activeStep, s.key);
          return (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 13,
                border: '1px solid var(--border)',
                background: st === 'active' ? 'var(--panel-2)' : 'transparent',
                color: st === 'pending' ? 'var(--muted)' : 'var(--text)',
              }}
            >
              <span>{st === 'done' ? '✅' : st === 'active' ? '⏳' : '•'}</span>
              {s.label}
            </div>
          );
        })}
      </div>

      {status === 'error' && <p className="status error">{p.pipelineError}</p>}

      {/* Final video */}
      {finalUrl && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls preload="metadata" src={finalUrl} style={{ marginTop: 6 }} />
          <div style={{ marginTop: 10 }}>
            <a className="btn secondary" href={finalUrl} download>
              ⬇ Download final video
            </a>
          </div>
        </>
      )}

      {/* Re-edit prompt */}
      {status !== 'running' && (
        <>
          <label htmlFor="pipe-prompt" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 16 }}>
            Editing instructions <span className="muted">(optional — re-edit to apply)</span>
          </label>
          <textarea
            id="pipe-prompt"
            className="prompt-input"
            rows={2}
            placeholder="e.g. Faster pace, caption every line, introduce the speaker as “Sara, CEO”, more b-roll."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </>
      )}

      {/* Decision log */}
      {decisions.length > 0 && (
        <details open style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Decision log ({decisions.length} edits)
          </summary>
          <div style={{ marginTop: 10 }}>
            {p.edl?.summary && (
              <p className="muted" style={{ marginTop: 0 }}>
                {p.edl.summary}
              </p>
            )}
            {decisions.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 96px 1fr',
                  gap: 10,
                  padding: '7px 0',
                  borderTop: '1px solid var(--border)',
                  alignItems: 'baseline',
                }}
              >
                <span>{OP_ICON[d.type] ?? '•'}</span>
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
        </details>
      )}

      {p.finalWarnings && p.finalWarnings.length > 0 && (
        <ul className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          {p.finalWarnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
