'use client';

import { useCallback, useRef, useState } from 'react';

type Phase = 'idle' | 'presigning' | 'uploading' | 'ingesting' | 'done' | 'error';

export default function UploadPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'presigning' || phase === 'uploading' || phase === 'ingesting';

  const upload = useCallback(async (file: File) => {
    try {
      setPhase('presigning');
      setProgress(0);
      setMessage(`Preparing upload for ${file.name}…`);

      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'video/mp4',
        }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'Failed to create upload');
      }
      const { projectId: pid, uploadUrl } = await presignRes.json();
      setProjectId(pid);

      setPhase('uploading');
      setMessage('Uploading to storage…');
      await putWithProgress(uploadUrl, file, setProgress);

      setPhase('ingesting');
      setMessage('Analyzing media (ffprobe)…');
      const ingestRes = await fetch(`/api/projects/${pid}/ingest`, { method: 'POST' });
      if (!ingestRes.ok) {
        const err = await ingestRes.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Ingest failed');
      }

      setPhase('done');
      setMessage('Done. Redirecting…');
      window.location.href = `/projects/${pid}`;
    } catch (err) {
      setPhase('error');
      setMessage((err as Error).message);
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
        Drop a raw B2B talking-head video. We store it, then probe it with ffprobe. Editing
        comes in later phases.
      </p>

      <div className="card">
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
            <strong>Working… please keep this tab open</strong>
          ) : (
            <>
              <strong>Click or drop a video here</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                mp4 / mov / mkv / webm
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => onPick(e.target.files)}
          />
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
        Flow: presign → PUT to R2 → ffprobe ingest → project page.
      </p>
    </>
  );
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}
