import { ServerResponse } from 'http';
import { pumpUpstreamToResponse } from '../routes/camera/pumpUpstreamToResponse';

// Stands in for the response socket: write() reports "full" until the test drains it, which is what a
// tablet on weak Wi-Fi does to an MJPEG stream.
class SlowResponse {
  public readonly written: Uint8Array[] = [];
  public destroyed = false;
  private accepting = true;
  private drainListeners: (() => void)[] = [];
  private closeListeners: (() => void)[] = [];

  write(chunk: Uint8Array): boolean {
    this.written.push(chunk);
    return this.accepting;
  }

  stopAccepting(): void { this.accepting = false; }

  drain(): void {
    this.accepting = true;
    const listeners = this.drainListeners;
    this.drainListeners = [];
    for (const listener of listeners) listener();
  }

  destroy(): void {
    this.destroyed = true;
    const listeners = this.closeListeners;
    this.closeListeners = [];
    for (const listener of listeners) listener();
  }

  once(event: string, listener: () => void): this {
    if (event === 'drain') this.drainListeners.push(listener);
    if (event === 'close') this.closeListeners.push(listener);
    return this;
  }

  on(event: string, listener: () => void): this { return this.once(event, listener); }
  off(): this { return this; }
  removeListener(): this { return this; }
  listenerCount(): number { return 0; }
}

function upstreamOf(chunks: string[], onPull: (index: number) => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull(index);
      if (index >= chunks.length) { controller.close(); return; }
      controller.enqueue(new TextEncoder().encode(chunks[index++]));
    },
  });
}

const asResponse = (slow: SlowResponse): ServerResponse => slow as unknown as ServerResponse;

describe('pumpUpstreamToResponse', () => {
  it('copies the whole body when the client keeps up', async () => {
    const slow = new SlowResponse();
    await pumpUpstreamToResponse(upstreamOf(['a', 'b', 'c'], () => undefined), asResponse(slow));

    expect(slow.written.map((chunk) => new TextDecoder().decode(chunk)).join('')).toBe('abc');
  });

  // Without waiting for drain the loop keeps pulling at full speed and every undelivered frame piles up
  // in the heap for as long as the viewer stays open.
  it('stops pulling from upstream while the client is behind', async () => {
    const slow = new SlowResponse();
    let pulls = 0;
    const upstream = upstreamOf(['1', '2', '3', '4'], () => { pulls += 1; });

    slow.stopAccepting();
    const pumped = pumpUpstreamToResponse(upstream, asResponse(slow));
    await new Promise((resolve) => setImmediate(resolve));

    const pullsWhileBlocked = pulls;
    expect(slow.written).toHaveLength(1);

    slow.drain();
    await pumped;

    expect(pulls).toBeGreaterThan(pullsWhileBlocked);
    expect(slow.written.map((chunk) => new TextDecoder().decode(chunk)).join('')).toBe('1234');
  });

  it('gives up when the viewer disconnects mid-stream', async () => {
    const slow = new SlowResponse();
    const upstream = upstreamOf(['1', '2', '3'], () => undefined);

    slow.stopAccepting();
    const pumped = pumpUpstreamToResponse(upstream, asResponse(slow));
    await new Promise((resolve) => setImmediate(resolve));
    slow.destroy();

    await expect(pumped).resolves.toBeUndefined();
    expect(slow.written).toHaveLength(1);
  });
});
