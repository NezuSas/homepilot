import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * MediaService — handles physical file storage and retrieval for the local file system.
 */
export class MediaService {
  private readonly baseMediaDir: string;
  private static readonly ALLOWED_IMAGE_TYPES = new Set(['jpeg', 'jpg', 'png', 'webp']);
  private static readonly MAX_AVATAR_BYTES = 2 * 1024 * 1024;
  private static readonly MAX_BACKGROUND_BYTES = 8 * 1024 * 1024;
  private static readonly MAX_HOME_BYTES = 5 * 1024 * 1024;
  private homeImageOperation: Promise<void> = Promise.resolve();

  constructor(baseDir?: string) {
    // If not specified, stores media in <project_root>/data/media
    this.baseMediaDir = baseDir || path.join(process.cwd(), 'data', 'media');
  }

  /**
   * Parses a Base64 Data URI and saves it to a deterministic path for a user's avatar.
   * Format: /data/media/users/<username>/avatar.jpg
   * Returns the relative REST url path.
   */
  public async saveUserAvatar(username: string, dataUri: string): Promise<string> {
    this.assertSafePathSegment(username, 'username');
    const { extension, buffer } = this.parseImageDataUri(dataUri, MediaService.MAX_AVATAR_BYTES);

    const userDir = path.join(this.baseMediaDir, 'users', username);
    await fs.mkdir(userDir, { recursive: true });

    // Always overwrite avatar.jpg to avoid garbage accumulation
    const fileName = `avatar.${extension}`;
    const filePath = path.join(userDir, fileName);

    await fs.writeFile(filePath, buffer);

    // Return the relative REST path
    return `/media/users/${username}/${fileName}`;
  }

  /**
   * Saves a base64 background image for a specific tab in a dashboard.
   * Format: /data/media/dashboards/<dashboardId>/<tabId>/background.jpg
   * Returns the relative REST url path.
   */
  public async saveTabBackground(dashboardId: string, tabId: string, dataUri: string): Promise<string> {
    this.assertSafePathSegment(dashboardId, 'dashboardId');
    this.assertSafePathSegment(tabId, 'tabId');
    const { extension, buffer } = this.parseImageDataUri(dataUri, MediaService.MAX_BACKGROUND_BYTES);

    const tabDir = path.join(this.baseMediaDir, 'dashboards', dashboardId, tabId);
    
    // Clean old files/folder first to prevent mixed extensions (e.g. background.png and background.jpg) from piling up
    try {
      await fs.rm(tabDir, { recursive: true, force: true });
    } catch {}
    await fs.mkdir(tabDir, { recursive: true });

    // Save with the file extension
    const fileName = `background.${extension}`;
    const filePath = path.join(tabDir, fileName);

    await fs.writeFile(filePath, buffer);

    // Return the relative REST path
    return `/media/dashboards/${dashboardId}/${tabId}/${fileName}`;
  }

  /**
   * Deletes the background image for a specific tab in a dashboard.
   */
  public async deleteTabBackground(dashboardId: string, tabId: string): Promise<void> {
    this.assertSafePathSegment(dashboardId, 'dashboardId');
    this.assertSafePathSegment(tabId, 'tabId');
    const tabDir = path.join(this.baseMediaDir, 'dashboards', dashboardId, tabId);
    try {
      await fs.rm(tabDir, { recursive: true, force: true });
    } catch {}
  }

  /**
   * Deletes all backgrounds for a given dashboard when the dashboard is deleted.
   */
  public async deleteDashboardBackgrounds(dashboardId: string): Promise<void> {
    this.assertSafePathSegment(dashboardId, 'dashboardId');
    const dashboardDir = path.join(this.baseMediaDir, 'dashboards', dashboardId);
    try {
      await fs.rm(dashboardDir, { recursive: true, force: true });
    } catch {}
  }

  /** Home hero images share the existing persistent media root and have ordered slots. */
  public async listHomeImages(): Promise<Array<{ slot: number; url: string }>> {
    const homeDir = path.join(this.baseMediaDir, 'home');
    const entries = await fs.readdir(homeDir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const images = entries.flatMap((name) => {
      const match = /^image_home_([1-5])\.(jpg|png|webp)$/.exec(name);
      return match ? [{ slot: Number(match[1]), url: `/media/home/${name}` }] : [];
    });
    return images.sort((left, right) => left.slot - right.slot);
  }

  public async addHomeImage(dataUri: string): Promise<Array<{ slot: number; url: string }>> {
    return this.withHomeImageLock(async () => {
      const { extension, buffer } = this.parseImageDataUri(dataUri, MediaService.MAX_HOME_BYTES);
      const images = await this.listHomeImages();
      if (images.length >= 5) throw new Error('HOME_IMAGE_LIMIT');
      const slot = images.length + 1;
      if (images.some((image) => image.slot !== images.indexOf(image) + 1)) throw new Error('HOME_IMAGE_SLOTS_INVALID');
      const homeDir = path.join(this.baseMediaDir, 'home');
      await fs.mkdir(homeDir, { recursive: true });
      const staging = path.join(homeDir, `.image_home_tmp_upload_${process.pid}`);
      try {
        await fs.writeFile(staging, buffer, { flag: 'wx' });
        await fs.rename(staging, path.join(homeDir, `image_home_${slot}.${extension}`));
      } finally {
        await fs.rm(staging, { force: true });
      }
      return this.listHomeImages();
    });
  }

  public async deleteHomeImage(slot: number): Promise<Array<{ slot: number; url: string }>> {
    return this.withHomeImageLock(async () => {
      const images = await this.listHomeImages();
      if (!Number.isInteger(slot) || !images.some((image) => image.slot === slot)) throw new Error('HOME_IMAGE_NOT_FOUND');
      const homeDir = path.join(this.baseMediaDir, 'home');
      const source = path.join(homeDir, path.basename(images.find((image) => image.slot === slot)!.url));
      const staging = path.join(homeDir, `.image_home_tmp_deleted_${process.pid}`);
      const moved: Array<{ from: string; to: string }> = [];
      await fs.rename(source, staging);
      try {
        for (const image of images.filter((item) => item.slot > slot)) {
          const from = path.join(homeDir, path.basename(image.url));
          const to = path.join(homeDir, path.basename(image.url).replace(`image_home_${image.slot}.`, `image_home_${image.slot - 1}.`));
          await fs.rename(from, to);
          moved.push({ from, to });
        }
        await fs.unlink(staging);
      } catch (error) {
        for (const move of moved.reverse()) await fs.rename(move.to, move.from);
        await fs.rename(staging, source);
        throw error;
      }
      return this.listHomeImages();
    });
  }

  private async withHomeImageLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.homeImageOperation;
    let release!: () => void;
    this.homeImageOperation = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  /**
   * Resolves a relative REST URL to an absolute file system path.
   * e.g., /media/users/cesar/avatar.jpg -> /var/lib/homepilot/data/media/users/cesar/avatar.jpg
   */
  public resolvePhysicalPath(mediaRelativePath: string): string {
    const safePath = mediaRelativePath.startsWith('/media/') ? mediaRelativePath.slice(7) : mediaRelativePath;
    const mediaRoot = path.resolve(this.baseMediaDir);
    const resolvedPath = path.resolve(mediaRoot, safePath);
    if (resolvedPath !== mediaRoot && !resolvedPath.startsWith(`${mediaRoot}${path.sep}`)) {
      throw new Error('Invalid media path');
    }
    return resolvedPath;
  }

  private parseImageDataUri(dataUri: string, maxBytes: number): { extension: string; buffer: Buffer } {
    const matches = dataUri.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!matches || matches.length !== 3) throw new Error('Invalid image data URI');

    const requestedType = matches[1].toLowerCase();
    if (!MediaService.ALLOWED_IMAGE_TYPES.has(requestedType)) throw new Error('Unsupported image type');

    const buffer = Buffer.from(matches[2], 'base64');
    if (!buffer.length || buffer.length > maxBytes) throw new Error('Image exceeds allowed size');
    if (!this.hasExpectedImageSignature(requestedType, buffer)) throw new Error('Invalid image payload');

    return { extension: requestedType === 'jpeg' ? 'jpg' : requestedType, buffer };
  }

  private hasExpectedImageSignature(type: string, buffer: Buffer): boolean {
    if (type === 'jpeg' || type === 'jpg') {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (type === 'png') {
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  private assertSafePathSegment(value: string, name: string): void {
    if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
      throw new Error(`Invalid ${name}`);
    }
  }
}
