import { once } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { ServerResponse } from 'http';
import { streamFileToResponse } from '../routes/streamFileToResponse';

// A ServerResponse is only needed for its writable side here, so a PassThrough stands in for the socket.
function responseDouble(): ServerResponse & PassThrough {
  return new PassThrough() as unknown as ServerResponse & PassThrough;
}

describe('streamFileToResponse', () => {
  let directory: string;

  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-stream-')); });
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  it('sends the file when it is there', async () => {
    const file = path.join(directory, 'segment-00001.ts');
    fs.writeFileSync(file, 'segment-bytes');
    const res = responseDouble();

    streamFileToResponse(file, res, 'Test');

    const chunks: Buffer[] = [];
    for await (const chunk of res) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('segment-bytes');
  });

  // ffmpeg runs with delete_segments, so a segment can vanish between the existence check and the open.
  // Without an error listener the ReadStream would throw and end the whole Edge process.
  it('destroys the response instead of throwing when the file is already gone', async () => {
    const res = responseDouble();
    const unhandled: unknown[] = [];
    const onUncaught = (error: unknown) => unhandled.push(error);
    process.on('uncaughtException', onUncaught);

    try {
      expect(() => streamFileToResponse(path.join(directory, 'deleted.ts'), res, 'Test')).not.toThrow();
      await once(res, 'close');
      expect(res.destroyed).toBe(true);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('uncaughtException', onUncaught);
    }
  });

  it('stops reading when the viewer disconnects', async () => {
    const file = path.join(directory, 'segment-00002.ts');
    fs.writeFileSync(file, 'x'.repeat(256 * 1024));
    const res = responseDouble();

    streamFileToResponse(file, res, 'Test');
    res.destroy();
    await once(res, 'close');

    // The read stream is closed with the response, so a disconnected viewer leaks no file handle.
    await new Promise((resolve) => setImmediate(resolve));
    expect(res.destroyed).toBe(true);
  });
});
