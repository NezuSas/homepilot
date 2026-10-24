import { createReadStream } from 'fs';
import { ServerResponse } from 'http';
import { logRuntimeDiagnostic } from '../../../packages/shared/config/runtimeEnvironment';

/**
 * Sends a file as the body of a response whose headers are already written.
 *
 * `stream.pipe(res)` does not forward the stream's `error` event, and a `ReadStream` that emits `error`
 * with no listener throws, which ends the whole Edge process. That is not hypothetical here: ffmpeg runs
 * with `delete_segments`, so an HLS segment can be unlinked between the existence check and the open, and
 * the viewer would take every light, PLC and automation down with it. The response is simply destroyed
 * instead: the headers are already sent, so there is no status left to change, and the player retries.
 */
export function streamFileToResponse(filePath: string, res: ServerResponse, label: string): void {
  const stream = createReadStream(filePath);

  stream.once('error', (error: unknown) => {
    logRuntimeDiagnostic('warn', `[${label}] No se pudo enviar el archivo:`, error instanceof Error ? error.message : error);
    if (!res.writableEnded) res.destroy();
  });
  res.once('close', () => stream.destroy());

  stream.pipe(res);
}
