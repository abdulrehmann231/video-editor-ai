import { notFound } from 'next/navigation';
import { getProject, sourceUrl } from '@/lib/projects';
import type { MediaInfo } from '@/lib/ingest';

export const dynamic = 'force-dynamic';

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtBytes(n: number | null): string {
  if (n == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

function MediaTable({ media }: { media: MediaInfo }) {
  return (
    <dl className="kv">
      <dt>Duration</dt>
      <dd>{fmtDuration(media.durationSec)}</dd>
      <dt>Resolution</dt>
      <dd>
        {media.width && media.height ? `${media.width}×${media.height}` : '—'}
      </dd>
      <dt>Frame rate</dt>
      <dd>{media.fps ? `${media.fps} fps` : '—'}</dd>
      <dt>Video codec</dt>
      <dd>{media.videoCodec ?? '—'}</dd>
      <dt>Audio</dt>
      <dd>{media.hasAudio ? media.audioCodec ?? 'yes' : 'no audio track'}</dd>
      <dt>Container</dt>
      <dd>{media.container ?? '—'}</dd>
      <dt>Size</dt>
      <dd>{fmtBytes(media.sizeBytes)}</dd>
    </dl>
  );
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const url = sourceUrl(project);

  return (
    <>
      <p>
        <a href="/">← Upload another</a>
      </p>
      <h1>{project.filename}</h1>
      <p className="subtitle">
        <span className={`badge ${project.status}`}>{project.status}</span>{' '}
        <span className="muted mono">{project.id}</span>
      </p>

      <div className="card">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video controls preload="metadata" src={url} />
        <p className="muted mono" style={{ marginTop: 10, wordBreak: 'break-all' }}>
          {url}
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Media info</h2>
        {project.media ? (
          <MediaTable media={project.media} />
        ) : (
          <p className="muted">Not ingested yet.</p>
        )}
        {project.error && (
          <p className="status error" style={{ marginTop: 12 }}>
            {project.error}
          </p>
        )}
      </div>

      <p className="muted mono">
        Next: Phase 1 — Gemini analyzes this video and emits an Edit Decision List.
      </p>
    </>
  );
}
