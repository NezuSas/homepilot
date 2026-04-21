import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * MediaService — handles physical file storage and retrieval for the local file system.
 */
export class MediaService {
  private readonly baseMediaDir: string;

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
    const matches = dataUri.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid Base64 Data URI format');
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

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
   * Resolves a relative REST URL to an absolute file system path.
   * e.g., /media/users/cesar/avatar.jpg -> /var/lib/homepilot/data/media/users/cesar/avatar.jpg
   */
  public resolvePhysicalPath(mediaRelativePath: string): string {
    // Prevent directory traversal attacks
    const normalized = path.normalize(mediaRelativePath).replace(/^(\.\.[\/\\])+/, '');
    
    // Remote the leading '/media/' if present to append cleanly
    const safePath = normalized.startsWith('/media/') 
      ? normalized.substring(7) 
      : normalized;

    return path.join(this.baseMediaDir, safePath);
  }
}
