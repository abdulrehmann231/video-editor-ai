import { getEnv } from './env';

/**
 * Minimal Pexels Video API client for stock b-roll.
 * Docs: https://www.pexels.com/api/documentation/#videos
 */

const BASE = 'https://api.pexels.com/videos';

export interface PexelsVideoFile {
  id: number;
  quality: string; // 'hd' | 'sd' | 'uhd'
  file_type: string; // 'video/mp4'
  width: number | null;
  height: number | null;
  fps: number | null;
  link: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number; // seconds
  url: string;
  image: string;
  video_files: PexelsVideoFile[];
}

export interface PexelsSearchResult {
  total_results: number;
  page: number;
  per_page: number;
  videos: PexelsVideo[];
}

export type Orientation = 'landscape' | 'portrait' | 'square';

export interface SearchOptions {
  perPage?: number;
  page?: number;
  orientation?: Orientation;
  size?: 'large' | 'medium' | 'small';
}

export async function searchVideos(query: string, opts: SearchOptions = {}): Promise<PexelsSearchResult> {
  const env = getEnv();
  const params = new URLSearchParams({
    query,
    per_page: String(opts.perPage ?? 10),
    page: String(opts.page ?? 1),
  });
  if (opts.orientation) params.set('orientation', opts.orientation);
  if (opts.size) params.set('size', opts.size);

  const res = await fetch(`${BASE}/search?${params.toString()}`, {
    headers: { Authorization: env.PEXEL_API_KEY },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pexels search failed: ${res.status} ${res.statusText} ${body}`.trim());
  }
  return (await res.json()) as PexelsSearchResult;
}

/**
 * Pick the best downloadable file for a target orientation and max width,
 * preferring an mp4 whose aspect ratio matches and whose width is the largest
 * that does not exceed `maxWidth`.
 */
export function pickBestFile(
  video: PexelsVideo,
  opts: { orientation?: Orientation; maxWidth?: number } = {},
): PexelsVideoFile | null {
  const mp4s = video.video_files.filter(
    (f) => f.file_type === 'video/mp4' && f.width && f.height,
  );
  if (mp4s.length === 0) return null;

  const wantPortrait = opts.orientation === 'portrait';
  const wantLandscape = opts.orientation === 'landscape';
  const maxWidth = opts.maxWidth ?? 1920;

  // Prefer files matching the requested orientation; fall back to all.
  const oriented = mp4s.filter((f) => {
    const isPortrait = f.height! > f.width!;
    if (wantPortrait) return isPortrait;
    if (wantLandscape) return !isPortrait;
    return true;
  });
  const pool = oriented.length > 0 ? oriented : mp4s;

  // Within the width cap: pick the LARGEST (best quality that won't be huge).
  const within = pool.filter((f) => f.width! <= maxWidth);
  if (within.length > 0) {
    return within.reduce((best, f) => (f.width! > best.width! ? f : best));
  }
  // Everything exceeds the cap: pick the SMALLEST to minimize the download.
  return pool.reduce((best, f) => (f.width! < best.width! ? f : best));
}
