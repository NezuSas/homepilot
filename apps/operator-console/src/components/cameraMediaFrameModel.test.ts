import { classifyPlaybackProgress, STALL_THRESHOLD_MS, withRefreshMarker } from './cameraMediaFrameModel';

describe('cameraMediaFrameModel', () => {
  it('appends the refresh marker with the right separator', () => {
    expect(withRefreshMarker('http://cam/stream.m3u8', 123)).toBe('http://cam/stream.m3u8?refresh=123');
    expect(withRefreshMarker('http://cam/snap?token=a', 123)).toBe('http://cam/snap?token=a&refresh=123');
  });

  it('reports advancing playback when the playhead moved', () => {
    expect(classifyPlaybackProgress(5, 4, 0, 1_000_000)).toBe('advanced');
  });

  it('waits while the frozen playhead is within the grace period', () => {
    expect(classifyPlaybackProgress(5, 5, 1_000, 1_000 + STALL_THRESHOLD_MS - 1)).toBe('waiting');
  });

  it('flags a stall once the threshold is reached', () => {
    expect(classifyPlaybackProgress(5, 5, 1_000, 1_000 + STALL_THRESHOLD_MS)).toBe('stalled');
  });
});
