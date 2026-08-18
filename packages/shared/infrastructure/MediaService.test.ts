import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { MediaService } from './MediaService';

describe('MediaService image upload validation', () => {
  let mediaDirectory: string;
  const pngDataUri = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')}`;

  beforeEach(async () => {
    mediaDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'homepilot-media-'));
  });

  afterEach(async () => {
    await fs.rm(mediaDirectory, { recursive: true, force: true });
  });

  it('stores an allowed avatar image', async () => {
    const service = new MediaService(mediaDirectory);

    await expect(service.saveUserAvatar('owner', pngDataUri)).resolves.toBe('/media/users/owner/avatar.png');
  });

  it('rejects an unsupported image type before persisting it', async () => {
    const service = new MediaService(mediaDirectory);
    const avatar = 'data:image/svg+xml;base64,PHN2Zy8+';

    await expect(service.saveUserAvatar('owner', avatar)).rejects.toThrow('Unsupported image type');
  });

  it('rejects an oversized avatar before persisting it', async () => {
    const service = new MediaService(mediaDirectory);
    const avatar = `data:image/png;base64,${Buffer.alloc((2 * 1024 * 1024) + 1).toString('base64')}`;

    await expect(service.saveUserAvatar('owner', avatar)).rejects.toThrow('Image exceeds allowed size');
  });

  it('rejects a payload whose bytes do not match its claimed image type', async () => {
    const service = new MediaService(mediaDirectory);
    const disguisedPayload = 'data:image/png;base64,aGVsbG8=';

    await expect(service.saveUserAvatar('owner', disguisedPayload)).rejects.toThrow('Invalid image payload');
  });

  it('keeps resolved media paths inside the local media directory', () => {
    const service = new MediaService(mediaDirectory);

    expect(() => service.resolvePhysicalPath('/media/../../sensitive-file')).toThrow('Invalid media path');
  });
  it('replaces tab backgrounds deterministically and removes them with dashboard cleanup', async () => {
    const service = new MediaService(mediaDirectory);
    const firstPath = await service.saveTabBackground('dashboard-1', 'tab-1', pngDataUri);
    const firstPhysicalPath = service.resolvePhysicalPath(firstPath);
    expect(await fs.stat(firstPhysicalPath)).toBeDefined();

    const jpegDataUri = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0x01]).toString('base64')}`;
    const secondPath = await service.saveTabBackground('dashboard-1', 'tab-1', jpegDataUri);
    expect(secondPath).toBe('/media/dashboards/dashboard-1/tab-1/background.jpg');
    await expect(fs.access(firstPhysicalPath)).rejects.toThrow();

    await service.deleteTabBackground('dashboard-1', 'tab-1');
    await expect(fs.access(service.resolvePhysicalPath(secondPath))).rejects.toThrow();

    await service.saveTabBackground('dashboard-1', 'tab-2', pngDataUri);
    await service.deleteDashboardBackgrounds('dashboard-1');
    await expect(fs.access(path.join(mediaDirectory, 'dashboards', 'dashboard-1'))).rejects.toThrow();
  });

  it('validates path segments and resolves legitimate media paths under its root', async () => {
    const service = new MediaService(mediaDirectory);

    await expect(service.saveUserAvatar('../owner', pngDataUri)).rejects.toThrow('Invalid username');
    await expect(service.saveTabBackground('dashboard-1', 'nested/tab', pngDataUri)).rejects.toThrow('Invalid tabId');
    expect(service.resolvePhysicalPath('/media/users/owner/avatar.png')).toBe(path.join(mediaDirectory, 'users', 'owner', 'avatar.png'));
  });
  it('accepts JPEG and WEBP signatures and resolves both prefixed and bare media paths', async () => {
    const service = new MediaService(mediaDirectory);
    const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString('base64')}`;
    const webp = `data:image/webp;base64,${Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString('base64')}`;

    await expect(service.saveUserAvatar('jpeg-user', jpeg)).resolves.toBe('/media/users/jpeg-user/avatar.jpg');
    await expect(service.saveUserAvatar('webp-user', webp)).resolves.toBe('/media/users/webp-user/avatar.webp');
    expect(service.resolvePhysicalPath('users/jpeg-user/avatar.jpg')).toBe(path.join(mediaDirectory, 'users', 'jpeg-user', 'avatar.jpg'));
  });

  it('rejects malformed, empty, and unsafe image uploads before file system writes', async () => {
    const service = new MediaService(mediaDirectory);

    await expect(service.saveUserAvatar('', pngDataUri)).rejects.toThrow('Invalid username');
    await expect(service.saveUserAvatar('owner', 'not-a-data-uri')).rejects.toThrow('Invalid image data URI');
    await expect(service.saveUserAvatar('owner', 'data:image/png;base64,')).rejects.toThrow('Invalid image data URI');
    await expect(service.saveTabBackground('..', 'tab', pngDataUri)).rejects.toThrow('Invalid dashboardId');
    await expect(service.deleteTabBackground('dashboard', '../tab')).rejects.toThrow('Invalid tabId');
    await expect(service.deleteDashboardBackgrounds('folder/name')).rejects.toThrow('Invalid dashboardId');
  });
});