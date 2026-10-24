import { once } from 'events';
import { ServerResponse } from 'http';

/**
 * Copies an upstream camera body into the response, waiting when the client cannot keep up.
 *
 * `res.write()` returning false means the data is sitting in memory, not on the wire. For an MJPEG
 * stream — which has no natural end — ignoring that keeps pulling frames from Home Assistant at full
 * speed while a tablet on weak Wi-Fi drains them slowly, and every undelivered frame accumulates in the
 * heap for as long as the tab stays open, until the appliance runs out of memory and takes the device
 * control plane with it. Waiting for `drain` makes the slow client slow down the upstream read instead.
 */
export async function pumpUpstreamToResponse(body: ReadableStream<Uint8Array>, res: ServerResponse): Promise<void> {
  const reader = body.getReader();
  try {
    while (!res.destroyed) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!res.write(chunk.value) && !res.destroyed) {
        // Either the client drains or it disconnects; both end the wait.
        await Promise.race([once(res, 'drain'), once(res, 'close')]);
      }
    }
  } finally {
    // A client that left mid-stream must not keep the upstream response open.
    if (res.destroyed) await reader.cancel().catch(() => undefined);
  }
}
