'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FinalRenderMeta } from '@/lib/render/renderFinal';

type Status = 'idle' | 'rendering' | 'rendered' | 'error';

export default function ShortsPanel(props: {
  projectId: string;
  hasEdl: boolean;
  initialStatus: Status;
  initialUrl?: string | null;
  initialMeta?: FinalRenderMeta;
  initialError?: string;
}) {
  const [status, setStatus] = useState<Status>(props.initialStatus);
  const [url, setUrl] = useState<string | null>(props.initialUrl ?? null);
  const [meta, setMeta] = useState<FinalRenderMeta | undefined>(props.initialMeta);
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
    const { project, shortsUrl } = await res.json();
    const s: Status = project.shortsStatus ?? 'idle';
    setStatus(s);
    setMeta(project.shortsMeta);
    setError(project.shortsError);
    if (shortsUrl) setUrl(shortsUrl);
    if (s === 'rendered' || s === 'error') stop();
  }, [props.projectId]);

  useEffect(() => {
    if (status === 'rendering' && !pollRef.current) pollRef.current = setInterval(poll, 5000);
    return stop;
  }, [status, poll]);

  const run = useCallback(() => {
    setStatus('rendering');
    setError(undefined);
    fetch(`/api/projects/${props.projectId}/render-final?format=shorts`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setError(e.detail || e.error || 'Shorts render failed');
        }
        await poll();
      })
      .catch(() => {});
    if (!pollRef.current) pollRef.current = setInterval(poll, 5000);
  }, [props.projectId, poll]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>📱 9:16 Shorts version</h2>
        <button className="btn" onClick={run} disabled={status === 'rendering' || !props.hasEdl}>
          {status === 'rendering' ? 'Rendering…' : status === 'rendered' ? 'Re-render 9:16' : 'Make 9:16 Shorts'}
        </button>
      </div>

      {!props.hasEdl && <p className="muted">Run analysis first.</p>}
      {status === 'rendering' && <p className="status">Rendering a vertical 9:16 cut…</p>}
      {status === 'error' && <p className="status error">{error}</p>}

      {url && status !== 'rendering' && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginTop: 14, flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls preload="metadata" src={url} style={{ width: 240, borderRadius: 10 }} />
          <div>
            <a className="btn secondary" href={url} download>
              ⬇ Download Shorts
            </a>
            {meta && (
              <p className="muted mono" style={{ fontSize: 12, marginTop: 10 }}>
                {meta.width}×{meta.height} @ {meta.fps}fps{meta.music ? ' · music' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
