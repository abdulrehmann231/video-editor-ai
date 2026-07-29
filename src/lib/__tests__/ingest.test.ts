import { describe, it, expect } from 'vitest';
import { toMediaInfo } from '../ingest';

describe('toMediaInfo', () => {
  it('extracts video + audio info from ffprobe json', () => {
    const probe = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          avg_frame_rate: '30000/1001',
          r_frame_rate: '30000/1001',
        },
        { codec_type: 'audio', codec_name: 'aac' },
      ],
      format: { duration: '65.4', size: '10485760', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
    };
    const info = toMediaInfo(probe);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.fps).toBe(29.97);
    expect(info.hasAudio).toBe(true);
    expect(info.videoCodec).toBe('h264');
    expect(info.audioCodec).toBe('aac');
    expect(info.durationSec).toBe(65.4);
    expect(info.sizeBytes).toBe(10485760);
  });

  it('handles missing audio and unknown fps', () => {
    const info = toMediaInfo({
      streams: [{ codec_type: 'video', codec_name: 'vp9', width: 1280, height: 720, avg_frame_rate: '0/0' }],
      format: { duration: '10', format_name: 'webm' },
    });
    expect(info.hasAudio).toBe(false);
    expect(info.audioCodec).toBeNull();
    expect(info.fps).toBeNull();
    expect(info.sizeBytes).toBeNull();
  });

  it('is resilient to empty probe output', () => {
    const info = toMediaInfo({});
    expect(info).toMatchObject({
      durationSec: null,
      width: null,
      height: null,
      hasAudio: false,
    });
  });
});
