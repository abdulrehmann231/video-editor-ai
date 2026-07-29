'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderMeta } from '@/lib/render/renderCut';

type Status = 'idle' | 'rendering' | 'rendered' | 'error';

function fmt(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export default function RenderPanel(props: {
  projectId: string;
  hasEdl: boolean;
  initialStatus: Status;
  initialUrl?: string | null;
  initialMeta?: RenderMeta;
  initialError?: string;
}) {
  const [status, setStatus] = useState<Status>(props.initialStatus);
  const [url, setUrl] = useState<string | null>(props.initialUrl ?? null);
  const [meta, setMeta] = useState<RenderMeta | undefined>(props.initialMeta);
  const [error, setError] = useState<string | undefined>(props.initialError);
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
    const { project, renderUrl } = await res.json();
    const s: Status = project.renderStatus ?? 'idle';
    setStatus(s);
    setMeta(project.renderMeta);
    setError(project.renderError);
    if (renderUrl) setUrl(renderUrl);
    if (s === 'rendered' || s === 'error') stop();
  }, [props.projectId]);

  useEffect(() => {
    if (status === 'rendering' && !pollRef.current) pollRef.current = setInterval(poll, 4000);
    return stop;
  }, [status, poll]);

  const run = useCallback(() => {
    setStatus('rendering');
    setError(undefined);
    fetch(`/api/projects/${props.projectId}/render`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setError(e.detail || e.error || 'Render failed');
        }
        await poll();
      })
      .catch(() => {});
    if (!pollRef.current) pollRef.current = setInterval(poll, 4000);
  }, [props.projectId, poll]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Rendered cut</h2>
        <button className="btn" onClick={run} disabled={status === 'rendering' || !props.hasEdl}>
          {status === 'rendering'
            ? 'Rendering…'
            : status === 'rendered'
            ? 'Re-render'
            : 'Render cut'}
        </button>
      </div>

      {!props.hasEdl && <p className="muted">Run analysis first to produce an edit plan.</p>}
      {status === 'rendering' && (
        <p className="status">Applying cuts and normalizing audio with FFmpeg…</p>
      )}
      {status === 'error' && <p className="status error">{error}</p>}

      {url && status !== 'rendering' && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls preload="metadata" src={url} style={{ marginTop: 14 }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
            <a className="btn secondary" href={url} download>
              ⬇ Download
            </a>
            {meta && (
              <span className="muted mono" style={{ fontSize: 12 }}>
                {fmt(meta.sourceDurationSec)} → {fmt(meta.outputDurationSec)} · removed{' '}
                {meta.removedSec}s · {meta.keepSegments} segments · {fmtBytes(meta.sizeBytes)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
