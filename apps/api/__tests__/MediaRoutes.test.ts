import { EventEmitter, once } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';
import { MediaRoutes } from '../routes/MediaRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();
}

function createRequest(): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/media/missing.jpg';
  request.headers = {};
  return request;
}

describe('Feature: media route contract', () => {
  it('Scenario: Given an unknown route When media routes handle it Then it remains available to later handlers', async () => {
    const mediaService = { resolvePhysicalPath: jest.fn() } as unknown as MediaService;

    await expect(new MediaRoutes(mediaService).handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/health', 'GET', {} as BootstrapContainer)).resolves.toBe(false);
  });

  it('Scenario: Given missing media When it is requested Then a stable not-found API response is returned', async () => {
    const mediaService = {
      resolvePhysicalPath: jest.fn().mockReturnValue('C:/homepilot-test-missing-file.jpg'),
    } as unknown as MediaService;
    const response = new MockResponse();

    await new MediaRoutes(mediaService).handle(createRequest(), response as unknown as http.ServerResponse, '/media/missing.jpg', 'GET', {} as BootstrapContainer);

    expect(response.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('NOT_FOUND'));
  });
  it('Scenario: Given existing media When requested with GET Then it streams the file using its expected MIME type', async () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-media-route-'));
    const imagePath = path.join(tempDirectory, 'photo.png');
    fs.writeFileSync(imagePath, Buffer.from('png-payload'));
    const mediaService = { resolvePhysicalPath: jest.fn().mockReturnValue(imagePath) } as unknown as MediaService;
    const response = Object.assign(new PassThrough(), { writeHead: jest.fn() }) as unknown as http.ServerResponse & PassThrough;
    const payload: Buffer[] = [];
    response.on('data', (chunk: Buffer) => payload.push(Buffer.from(chunk)));

    try {
      await new MediaRoutes(mediaService).handle(createRequest(), response, '/media/photo.png', 'GET', {} as BootstrapContainer);
      await once(response, 'end');

      expect(response.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      });
      expect(Buffer.concat(payload).toString()).toBe('png-payload');
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('Scenario: Given an unsupported media extension When requested Then it falls back to binary content safely', async () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-media-route-'));
    const mediaPath = path.join(tempDirectory, 'snapshot.bin');
    fs.writeFileSync(mediaPath, Buffer.from('binary-payload'));
    const mediaService = { resolvePhysicalPath: jest.fn().mockReturnValue(mediaPath) } as unknown as MediaService;
    const response = Object.assign(new PassThrough(), { writeHead: jest.fn() }) as unknown as http.ServerResponse & PassThrough;
    response.resume();

    try {
      const streamEnded = once(response, 'end');
      await new MediaRoutes(mediaService).handle(createRequest(), response, '/media/snapshot.bin', 'GET', {} as BootstrapContainer);
      await streamEnded;

      expect(response.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      });
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('Scenario: Given a media path with a non-GET method When handled Then it remains available to later handlers', async () => {
    const mediaService = { resolvePhysicalPath: jest.fn() } as unknown as MediaService;

    await expect(new MediaRoutes(mediaService).handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/media/photo.png', 'POST', {} as BootstrapContainer)).resolves.toBe(false);
    expect(mediaService.resolvePhysicalPath).not.toHaveBeenCalled();
  });

  it('Scenario: Given an unexpected media resolution failure When requested Then it returns a sanitized internal error', async () => {
    const mediaService = { resolvePhysicalPath: jest.fn().mockImplementation(() => { throw new Error('unsafe path detail'); }) } as unknown as MediaService;
    const response = new MockResponse();

    await new MediaRoutes(mediaService).handle(createRequest(), response as unknown as http.ServerResponse, '/media/photo.webp', 'GET', {} as BootstrapContainer);

    expect(response.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INTERNAL_ERROR'));
  });
});