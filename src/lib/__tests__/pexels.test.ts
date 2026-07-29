import { describe, it, expect } from 'vitest';
import { pickBestFile, type PexelsVideo } from '../pexels';

function video(files: Array<[number, number]>): PexelsVideo {
  return {
    id: 1,
    width: 1920,
    height: 1080,
    duration: 12,
    url: 'https://pexels.com/x',
    image: 'https://pexels.com/x.jpg',
    video_files: files.map(([w, h], i) => ({
      id: i,
      quality: w >= 1920 ? 'hd' : 'sd',
      file_type: 'video/mp4',
      width: w,
      height: h,
      fps: 30,
      link: `https://download/${w}x${h}.mp4`,
    })),
  };
}

describe('pickBestFile', () => {
  it('returns null when no mp4 files exist', () => {
    const v = video([]);
    expect(pickBestFile(v)).toBeNull();
  });

  it('prefers landscape files when landscape requested', () => {
    const v = video([
      [1080, 1920], // portrait
      [1280, 720], // landscape
    ]);
    const best = pickBestFile(v, { orientation: 'landscape', maxWidth: 1920 });
    expect(best?.width).toBe(1280);
    expect(best?.height).toBe(720);
  });

  it('prefers portrait files when portrait requested', () => {
    const v = video([
      [1280, 720],
      [1080, 1920],
    ]);
    const best = pickBestFile(v, { orientation: 'portrait', maxWidth: 1920 });
    expect(best?.height).toBe(1920);
  });

  it('picks the largest width within the cap for a given orientation', () => {
    const v = video([
      [640, 360],
      [1280, 720],
      [1920, 1080],
    ]);
    const best = pickBestFile(v, { orientation: 'landscape', maxWidth: 1280 });
    expect(best?.width).toBe(1280);
  });
});
