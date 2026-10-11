import * as path from 'path';
import { createCameraProxyToken, verifyCameraProxyToken } from '../routes/camera/cameraProxyToken';
import { isInsideDirectory } from '../routes/camera/pathContainment';

describe('Feature: camera media path containment', () => {
  const base = path.resolve('data', 'hls', 'camera-1');

  it('accepts the directory and files inside it', () => {
    expect(isInsideDirectory(base, base)).toBe(true);
    expect(isInsideDirectory(path.join(base, 'segment0.ts'), base)).toBe(true);
    expect(isInsideDirectory(path.join(base, 'nested', 'index.m3u8'), base)).toBe(true);
  });

  it('rejects a sibling directory that merely shares the prefix', () => {
    expect(isInsideDirectory(`${base}-other${path.sep}segment0.ts`, base)).toBe(false);
  });

  it('rejects parent traversal and unrelated absolute paths', () => {
    expect(isInsideDirectory(path.join(base, '..', 'camera-2', 'segment0.ts'), base)).toBe(false);
    expect(isInsideDirectory(path.resolve('etc', 'passwd'), base)).toBe(false);
  });
});

describe('Feature: camera proxy token signing', () => {
  const previous = { signing: process.env.CAMERA_PROXY_SIGNING_SECRET, ha: process.env.HOME_ASSISTANT_TOKEN };
  afterEach(() => {
    if (previous.signing === undefined) delete process.env.CAMERA_PROXY_SIGNING_SECRET; else process.env.CAMERA_PROXY_SIGNING_SECRET = previous.signing;
    if (previous.ha === undefined) delete process.env.HOME_ASSISTANT_TOKEN; else process.env.HOME_ASSISTANT_TOKEN = previous.ha;
  });

  it('verifies its own token only for the same camera', () => {
    delete process.env.CAMERA_PROXY_SIGNING_SECRET;
    const token = createCameraProxyToken('camera-1');
    expect(verifyCameraProxyToken(token, 'camera-1')).toBe(true);
    expect(verifyCameraProxyToken(token, 'camera-2')).toBe(false);
  });

  it('does not sign with the Home Assistant token', () => {
    delete process.env.CAMERA_PROXY_SIGNING_SECRET;
    process.env.HOME_ASSISTANT_TOKEN = 'ha-token-value';
    const token = createCameraProxyToken('camera-1');
    process.env.HOME_ASSISTANT_TOKEN = 'a-different-ha-token';
    expect(verifyCameraProxyToken(token, 'camera-1')).toBe(true);
  });

  it('uses the configured secret when there is one', () => {
    process.env.CAMERA_PROXY_SIGNING_SECRET = 'configured-secret';
    const token = createCameraProxyToken('camera-1');
    process.env.CAMERA_PROXY_SIGNING_SECRET = 'rotated-secret';
    expect(verifyCameraProxyToken(token, 'camera-1')).toBe(false);
  });

  it('rejects a token forged with the published development constant', () => {
    delete process.env.CAMERA_PROXY_SIGNING_SECRET;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as typeof import('crypto');
    const payload = Buffer.from(JSON.stringify({ deviceId: 'camera-1', expiresAt: Date.now() + 60000, nonce: 'x' })).toString('base64url');
    const forged = `${payload}.${crypto.createHmac('sha256', 'homepilot-camera-proxy-development-secret').update(payload).digest('base64url')}`;
    expect(verifyCameraProxyToken(forged, 'camera-1')).toBe(false);
  });
});
