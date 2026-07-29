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
});
