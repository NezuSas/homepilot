import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import { RouteHandler } from '../RouteHandler';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ServerResponse } from 'http';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';

export class MediaRoutes implements RouteHandler {
  private mediaService: MediaService;

  constructor() {
    this.mediaService = new MediaService();
  }

  async handle(req: HomePilotRequest, res: ServerResponse, pathname: string, method: string, container: BootstrapContainer): Promise<boolean> {
    
    if (pathname.startsWith('/media/') && method === 'GET') {
      try {
        const physicalPath = this.mediaService.resolvePhysicalPath(pathname);
        
        // Ensure file exists
        await fs.access(physicalPath);
        
        // Simple MIME resolving (since we know it's media)
        const ext = path.extname(physicalPath).toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.svg') mimeType = 'image/svg+xml';

        res.writeHead(200, {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=86400' // cache for 1 day, query parameter ?t=... will bust it
        });

        // Stream file to response
        const stream = createReadStream(physicalPath);
        stream.pipe(res);
        return true;
      } catch (err: any) {
        if (err.code === 'ENOENT') {
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
