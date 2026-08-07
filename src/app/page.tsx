'use client';

import { useCallback, useRef, useState } from 'react';

type Phase = 'idle' | 'creating' | 'uploading' | 'finalizing' | 'ingesting' | 'done' | 'error';

interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

const UPLOAD_CONCURRENCY = 4;

export default function UploadPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [prompt, setPrompt] = useState('');
  const promptRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'creating' || phase === 'uploading' || phase === 'finalizing' || phase === 'ingesting';

  const upload = useCallback(async (file: File) => {
    let pid: string | null = null;
    try {
      setPhase('creating');
      setProgress(0);
      setMessage(`Preparing upload for ${file.name} (${fmtSize(file.size)})…`);

      const createRes = await fetch('/api/uploads/multipart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'video/mp4',
          size: file.size,
          prompt: promptRef.current.trim() || undefined,
        }),
      });
      if (!createRes.ok) throw new Error((await createRes.json().catch(() => ({}))).detail || 'Failed to start upload');
      const { projectId: id, partSize, partCount } = await createRes.json();
      pid = id;
      setProjectId(id);

      setPhase('uploading');
      setMessage(`Uploading ${partCount} part${partCount > 1 ? 's' : ''}…`);
      const parts = await multipartUpload(id, file, partSize, partCount, setProgress);

      setPhase('finalizing');
      setMessage('Finalizing upload…');
      const done = await fetch('/api/uploads/multipart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, parts }),
      });
      if (!done.ok) throw new Error((await done.json().catch(() => ({}))).detail || 'Failed to finalize upload');

      setPhase('ingesting');
      setMessage('Analyzing media & starting the AI edit…');
      const ingest = await fetch(`/api/projects/${id}/ingest`, { method: 'POST' });
      if (!ingest.ok) throw new Error((await ingest.json().catch(() => ({}))).detail || 'Ingest failed');

      setPhase('done');
      setMessage('Done. Redirecting…');
      window.location.href = `/projects/${id}`;
    } catch (err) {
      setPhase('error');
      setMessage((err as Error).message);
      if (pid) {
        fetch('/api/uploads/multipart/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pid }),
        }).catch(() => {});
      }
    }
  }, []);

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) upload(file);
  };

  return (
    <>
      <h1>Upload a video</h1>
      <p className="subtitle">
        Drop a raw B2B talking-head video (large 4K files welcome — uploads are chunked &amp;
        resumable). The AI edits it automatically: tight cuts, captions, punch-in zooms, lower
        thirds &amp; b-roll.
      </p>

      <div className="card">
        <label htmlFor="prompt" style={{ fontWeight: 600, fontSize: 14 }}>
          Editing instructions <span className="muted">(optional)</span>
        </label>
        <textarea
          id="prompt"
          className="prompt-input"
          placeholder="e.g. Punchy pace, heavy word-captions, zoom on the hook. Introduce the speaker as “Sara Lee, CEO”. Add b-roll for anything about analytics."
          value={prompt}
          disabled={busy}
          onChange={(e) => {
            setPrompt(e.target.value);
            promptRef.current = e.target.value;
          }}
          rows={3}
        />
        <p className="muted" style={{ fontSize: 12, margin: '4px 0 16px' }}>
          Steers the AI editor. Leave blank to use the default B2B talking-head style.
        </p>

        <div
          className={`dropzone${drag ? ' drag' : ''}`}
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) onPick(e.dataTransfer.files);
          }}
        >
          {busy ? (
            <strong>Working… keep this tab open</strong>
          ) : (
            <>
              <strong>Click or drop a video here</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                mp4 / mov / mkv / webm · multi-GB OK
              </div>
            </>
          )}
          <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => onPick(e.target.files)} />
        </div>

        {(busy || phase === 'error' || phase === 'done') && (
          <>
            {phase === 'uploading' && (
              <div className="progress">
                <span style={{ width: `${progress}%` }} />
              </div>
            )}
            <div className={`status${phase === 'error' ? ' error' : ''}`}>
              {message}
              {phase === 'uploading' ? ` (${progress}%)` : ''}
              {projectId && phase === 'error' && (
                <>
                  {' '}
                  <a href={`/projects/${projectId}`}>view project</a>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <p className="muted mono">
        Flow: multipart upload → R2 → ffprobe ingest → auto AI edit.
      </p>
    </>
  );
}

async function multipartUpload(
  projectId: string,
  file: File,
  partSize: number,
  partCount: number,
  onProgress: (pct: number) => void,
): Promise<CompletedPart[]> {
  const parts = new Array<CompletedPart>(partCount);
  const uploaded = new Array<number>(partCount).fill(0);
  const total = file.size;
  let cursor = 0;

  const report = () => {
    const sum = uploaded.reduce((a, b) => a + b, 0);
    onProgress(Math.min(100, Math.round((sum / total) * 100)));
  };

  async function worker() {
    for (;;) {
      const idx = cursor++;
      if (idx >= partCount) return;
      const partNumber = idx + 1;
      const start = idx * partSize;
      const blob = file.slice(start, Math.min(total, start + partSize));
      const etag = await uploadPartWithRetry(projectId, partNumber, blob, (loaded) => {
        uploaded[idx] = loaded;
        report();
      });
      parts[idx] = { PartNumber: partNumber, ETag: etag };
      uploaded[idx] = blob.size;
      report();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, partCount) }, () => worker()),
  );
  return parts;
}

async function uploadPartWithRetry(
  projectId: string,
  partNumber: number,
  blob: Blob,
  onLoaded: (loaded: number) => void,
  attempts = 3,
): Promise<string> {
  let lastErr: unknown;
  for (let a = 1; a <= attempts; a++) {
    try {
      const signRes = await fetch('/api/uploads/multipart/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, partNumber }),
      });
      if (!signRes.ok) throw new Error(`sign failed (HTTP ${signRes.status})`);
      const { url } = await signRes.json();
      const etag = await putPart(url, blob, onLoaded);
      if (!etag) throw new Error('missing ETag — check R2 CORS ExposeHeaders: ETag');
      return etag;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * a));
    }
  }
  throw new Error(`part ${partNumber} failed: ${(lastErr as Error)?.message ?? lastErr}`);
}

/** No-progress window after which a part is considered stalled and aborted. */
const PART_STALL_MS = 60_000;

function putPart(url: string, blob: Blob, onLoaded: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Watchdog: if neither the upload nor the server response makes progress for
    // PART_STALL_MS, abort so uploadPartWithRetry re-signs and retries. Without
    // this, a stalled connection AFTER the body is sent (bar shows 100% but the
    // ETag response never arrives) hangs the whole upload forever.
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        xhr.abort();
        reject(new Error(`part stalled (no progress for ${PART_STALL_MS / 1000}s)`));
      }, PART_STALL_MS);
    };
    const done = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      arm();
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () =>
      done(() =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve(xhr.getResponseHeader('ETag') || '')
          : reject(new Error(`part HTTP ${xhr.status}`)),
      );
    xhr.onerror = () => done(() => reject(new Error('network error during part upload')));
    xhr.onabort = () => clearTimeout(timer);
    arm();
    xhr.send(blob);
  });
}

function fmtSize(n: number): string {
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i >= 2 ? 1 : 0)} ${u[i]}`;
}
