import { createCameraProxyToken, verifyCameraProxyToken } from '../routes/camera/cameraProxyToken';
import { buildCameraMediaPaths, pathnameFallback, resolveCameraEntityId } from '../routes/camera/cameraEntity';
import { resolveHlsPath, rewriteHlsManifest } from '../routes/camera/hlsManifest';
import type { Device } from '../../../packages/devices/domain/types';

describe('camera route helpers', () => {
  describe('camera proxy token', () => {
    it('verifies a fresh token only for its own device', () => {
      const token = createCameraProxyToken('cam-1');
      expect(verifyCameraProxyToken(token, 'cam-1')).toBe(true);
      expect(verifyCameraProxyToken(token, 'cam-2')).toBe(false);
    });

    it('rejects malformed and tampered tokens', () => {
      const token = createCameraProxyToken('cam-1');
      const [payload] = token.split('.');
      expect(verifyCameraProxyToken('', 'cam-1')).toBe(false);
      expect(verifyCameraProxyToken(payload, 'cam-1')).toBe(false);
      expect(verifyCameraProxyToken(`${payload}.invalid`, 'cam-1')).toBe(false);
    });

    it('rejects expired tokens', () => {
      const now = Date.now();
      const token = createCameraProxyToken('cam-1');
      const spy = jest.spyOn(Date, 'now').mockReturnValue(now + 31 * 60 * 1000);
      try {
        expect(verifyCameraProxyToken(token, 'cam-1')).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('camera entity helpers', () => {
    const base = { id: 'd', type: 'camera', integrationSource: 'ha', externalId: 'ha:camera.front' } as unknown as Device;

    it('resolves entity ids', () => {
      expect(resolveCameraEntityId(null)).toBeNull();
      expect(resolveCameraEntityId(base)).toBe('camera.front');
      expect(resolveCameraEntityId({ ...base, externalId: 'ha:light.x' })).toBeNull();
      expect(resolveCameraEntityId({ ...base, integrationSource: 'native-camera', externalId: 'native:1' })).toBe('native');
    });

    it('builds encoded paths', () => {
      const paths = buildCameraMediaPaths('a/b', 'tok.en');
      expect(paths.snapshotPath).toBe('/api/v1/devices/a%2Fb/camera/snapshot?token=tok.en');
      expect(paths.streamPath).toBe('/api/v1/devices/a%2Fb/camera/stream?token=tok.en');
      expect(paths.hlsPath).toBe('/api/v1/devices/a%2Fb/camera/hls/master.m3u8?token=tok.en');
      expect(pathnameFallback('stream', 'a b')).toBe('/api/v1/devices/a%20b/camera/stream');
    });
  });

  describe('hls manifest', () => {
    it('resolves only Home Assistant HLS paths', () => {
      expect(resolveHlsPath('/api/hls/abc/master.m3u8', 'seg.ts?x=1')).toBe('/api/hls/abc/seg.ts?x=1');
      expect(() => resolveHlsPath('/api/hls/abc/master.m3u8', 'http://evil.test/api/hls/x')).toThrow('CAMERA_HLS_RESOURCE_INVALID');
      expect(() => resolveHlsPath('/api/hls/abc/master.m3u8', '/other/x')).toThrow('CAMERA_HLS_RESOURCE_INVALID');
    });

    it('rewrites URIs to opaque proxy resources and reuses ids', () => {
      const session = { deviceId: 'cam 1', resourcesById: new Map<string, string>(), resourceIdsByPath: new Map<string, string>() };
      const manifest = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\nseg1.ts\nseg1.ts\ndata:foo\n';
      const out = rewriteHlsManifest(manifest, '/api/hls/abc/master.m3u8', session, 'tk');
      const lines = out.split('\n');
      expect(lines[0]).toBe('#EXTM3U');
      expect(lines[1]).toMatch(/^#EXT-X-MAP:URI="\/api\/v1\/devices\/cam%201\/camera\/hls\/resource\/[\w-]+\?token=tk"$/);
      expect(lines[2]).toBe(lines[3]);
      expect(lines[2]).not.toContain('seg1.ts');
      expect(session.resourcesById.size).toBe(2);
    });

    it('enforces the per-session resource limit', () => {
      const resourcesById = new Map<string, string>();
      for (let i = 0; i < 1024; i += 1) resourcesById.set(`r${i}`, `/p${i}`);
      const session = { deviceId: 'c', resourcesById, resourceIdsByPath: new Map<string, string>() };
      expect(() => rewriteHlsManifest('seg.ts', '/api/hls/a/m.m3u8', session, 't')).toThrow('CAMERA_HLS_RESOURCE_LIMIT');
    });
  });
});
