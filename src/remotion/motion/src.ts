import { staticFile } from 'remotion';

/**
 * Resolve a media source string for OffthreadVideo/img. A `public/`-prefixed
 * value is served from the Remotion bundle's public folder via staticFile
 * (handy for bundled test clips or brand assets); anything else (http(s) URL) is
 * passed through unchanged.
 */
export function resolveSrc(src: string): string {
  if (src.startsWith('public/')) return staticFile(src.slice('public/'.length));
  return src;
}
