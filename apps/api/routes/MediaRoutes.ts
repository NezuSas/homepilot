import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import { ServerResponse } from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { RouteHandler } from '../RouteHandler';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';

export class MediaRoutes implements RouteHandler {
  constructor(private readonly mediaService: MediaService) {}

  async handle(req: HomePilotRequest, res: ServerResponse, pathname: string, method: string, _container: BootstrapContainer): Promise<boolean> {
    if (pathname.startsWith('/media/') && method === 'GET') {
      try {
        const physicalPath = this.mediaService.resolvePhysicalPath(pathname);
        await fs.access(physicalPath);
        const ext = path.extname(physicalPath).toLowerCase();
        const mimeTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
        createReadStream(physicalPath).pipe(res);
        return true;
      } catch (error: unknown) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        if (code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Media not found' } }));
          return true;
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Error serving media' } }));
        return true;
      }
    }
    return false;
  }
}