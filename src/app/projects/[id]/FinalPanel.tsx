'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FinalRenderMeta } from '@/lib/render/renderFinal';

type Status = 'idle' | 'rendering' | 'rendered' | 'error';

export default function FinalPanel(props: {
  projectId: string;
  hasEdl: boolean;
  initialStatus: Status;
  initialUrl?: string | null;
  initialMeta?: FinalRenderMeta;
  initialError?: string;
  initialWarnings?: string[];
}) {
  const [status, setStatus] = useState<Status>(props.initialStatus);
  const [url, setUrl] = useState<string | null>(props.initialUrl ?? null);
  const [meta, setMeta] = useState<FinalRenderMeta | undefined>(props.initialMeta);
  const [error, setError] = useState<string | undefined>(props.initialError);
  const [warnings, setWarnings] = useState<string[]>(props.initialWarnings ?? []);
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
    const { project, finalUrl } = await res.json();
    const s: Status = project.finalStatus ?? 'idle';
    setStatus(s);
    setMeta(project.finalMeta);
    setError(project.finalError);
    setWarnings(project.finalWarnings ?? []);
    if (finalUrl) setUrl(finalUrl);
    if (s === 'rendered' || s === 'error') stop();
  }, [props.projectId]);

  useEffect(() => {
    if (status === 'rendering' && !pollRef.current) pollRef.current = setInterval(poll, 5000);
    return stop;
  }, [status, poll]);

  const run = useCallback(() => {
    setStatus('rendering');
    setError(undefined);
    fetch(`/api/projects/${props.projectId}/render-final`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setError(e.detail || e.error || 'Final render failed');
        }
        await poll();
      })
      .catch(() => {});
    if (!pollRef.current) pollRef.current = setInterval(poll, 5000);
  }, [props.projectId, poll]);

  return (
    <div className="card" style={{ borderColor: '#2b3a55' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>✨ Final video (captions · zooms · lower thirds · b-roll)</h2>
        <button className="btn" onClick={run} disabled={status === 'rendering' || !props.hasEdl}>
          {status === 'rendering' ? 'Rendering…' : status === 'rendered' ? 'Re-render' : 'Render final'}
        </button>
      </div>

      {!props.hasEdl && <p className="muted">Run analysis first to produce an edit plan.</p>}
      {status === 'rendering' && (
        <p className="status">
          Compositing motion graphics with Remotion (headless Chrome). This is the slowest
          step — a minute or more depending on length.
        </p>
      )}
      {status === 'error' && <p className="status error">{error}</p>}

      {url && status !== 'rendering' && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls preload="metadata" src={url} style={{ marginTop: 14 }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <a className="btn secondary" href={url} download>
              ⬇ Download final
            </a>
            {meta && (
              <span className="muted mono" style={{ fontSize: 12 }}>
                {meta.width}×{meta.height} @ {meta.fps}fps · {meta.captions} captions ·{' '}
                {meta.zooms} zooms · {meta.lowerThirds} lower-thirds · {meta.brollsResolved}/
                {meta.brolls} b-roll
              </span>
            )}
          </div>
          {warnings.length > 0 && (
            <ul className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
