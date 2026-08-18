import { EventEmitter } from 'events';

const spawnMock = jest.fn();
const mockFs = {
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  statSync: jest.fn()
};
jest.mock('child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));
jest.mock('os', () => ({ tmpdir: () => '/tmp' }));
jest.mock('fs', () => mockFs);

import { FfmpegMediaTranscoder } from '../infrastructure/FfmpegMediaTranscoder';

type FakeProcess = EventEmitter & {
  killed: boolean;
  exitCode: number | null;
  stderr: EventEmitter;
  stdout: { pipe: jest.Mock };
  kill: jest.Mock;
};

function processStub(): FakeProcess {
  const process = new EventEmitter() as FakeProcess;
  process.killed = false;
  process.exitCode = null;
  process.stderr = new EventEmitter();
  process.stdout = { pipe: jest.fn() };
  process.kill = jest.fn();
  return process;
}

const endpoint = {
  host: '192.168.1.20',
  rtspPort: 554,
  rtspPath: 'stream',
  username: 'camera user',
  password: 'p@ss word'
};

describe('FfmpegMediaTranscoder', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.unlinkSync.mockReturnValue(undefined);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('#EXTM3U\nsegment-00001.ts');
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('starts one healthy HLS runtime, reuses it, and terminates it on stop', async () => {
    const process = processStub();
    spawnMock.mockReturnValue(process);
    const transcoder = new FfmpegMediaTranscoder();

    const first = await transcoder.ensureHlsRuntime('camera-1', endpoint);
    const second = await transcoder.ensureHlsRuntime('camera-1', endpoint);

    expect(first).toEqual(second);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-i', 'rtsp://camera%20user:p%40ss%20word@192.168.1.20:554/stream',
      '-f', 'hls'
    ]));

    transcoder.stopHlsRuntime('camera-1');
    expect(process.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('builds snapshot and MJPEG processes with browser-safe response headers and closes streams', () => {
    const snapshotProcess = processStub();
    const mjpegProcess = processStub();
    spawnMock.mockReturnValueOnce(snapshotProcess).mockReturnValueOnce(mjpegProcess);
    const response = new EventEmitter() as EventEmitter & { writeHead: jest.Mock };
    response.writeHead = jest.fn();
    const transcoder = new FfmpegMediaTranscoder();

    transcoder.streamSnapshot({ ...endpoint, rtspPath: '/stream?username=embedded' }, response as never);
    transcoder.streamMjpeg(endpoint, response as never);

    expect(snapshotProcess.stdout.pipe).toHaveBeenCalledWith(response);
    expect(mjpegProcess.stdout.pipe).toHaveBeenCalledWith(response);
    expect(response.writeHead).toHaveBeenNthCalledWith(1, 200, expect.objectContaining({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store, max-age=0' }));
    expect(response.writeHead).toHaveBeenNthCalledWith(2, 200, expect.objectContaining({ 'Content-Type': 'multipart/x-mixed-replace; boundary=--ffmpeg' }));
    expect(spawnMock).toHaveBeenNthCalledWith(1, 'ffmpeg', expect.arrayContaining(['-vframes', '1', '-i', 'rtsp://192.168.1.20:554/stream?username=embedded']));
    expect(spawnMock).toHaveBeenNthCalledWith(2, 'ffmpeg', expect.arrayContaining(['-c:v', 'mjpeg', '-f', 'mpjpeg']));
    response.emit('close');
    expect(mjpegProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('rejects an HLS startup timeout as an authentication failure when ffmpeg reports authorization', async () => {
    const process = processStub();
    spawnMock.mockReturnValue(process);
    mockFs.existsSync.mockReturnValue(false);
    const transcoder = new FfmpegMediaTranscoder();
    const started = transcoder.ensureHlsRuntime('camera-1', endpoint);
    const rejection = expect(started).rejects.toThrow('NATIVE_CAMERA_AUTH_FAILED');
    process.stderr.emit('data', Buffer.from('401 Unauthorized'));
    process.killed = true;
    await jest.advanceTimersByTimeAsync(8_000);

    await rejection;
  });
  it('treats old or unreadable HLS manifests as stale while accepting fresh output', () => {
    const transcoder = new FfmpegMediaTranscoder();
    const internals = transcoder as unknown as { isSegmentOutputStale(filePath: string): boolean };
    mockFs.statSync.mockReturnValueOnce({ mtimeMs: Date.now() - 1_000 });
    expect(internals.isSegmentOutputStale('/tmp/fresh.m3u8')).toBe(false);

    mockFs.statSync.mockReturnValueOnce({ mtimeMs: Date.now() - 20_000 });
    expect(internals.isSegmentOutputStale('/tmp/stale.m3u8')).toBe(true);

    mockFs.statSync.mockImplementationOnce(() => { throw new Error('missing'); });
    expect(internals.isSegmentOutputStale('/tmp/missing.m3u8')).toBe(true);
  });

  it('reuses embedded RTSP credentials instead of duplicating them in the URL', () => {
    const process = processStub();
    spawnMock.mockReturnValue(process);
    const response = new EventEmitter() as EventEmitter & { writeHead: jest.Mock };
    response.writeHead = jest.fn();
    const transcoder = new FfmpegMediaTranscoder();

    transcoder.streamSnapshot({ ...endpoint, rtspPath: '/live?username=embedded&password=value' }, response as never);

    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining(['-i', 'rtsp://192.168.1.20:554/live?username=embedded&password=value']));
  });
  it('terminates active ffmpeg processes gracefully and skips already stopped processes', async () => {
    const transcoder = new FfmpegMediaTranscoder();
    const internals = transcoder as unknown as { terminateProcess(process: FakeProcess, timeoutMs?: number): Promise<void> };
    const active = processStub();
    const stopping = internals.terminateProcess(active, 1000);
    expect(active.kill).toHaveBeenCalledWith('SIGTERM');
    active.exitCode = 0;
    active.emit('exit', 0, null);
    await stopping;

    const alreadyStopped = processStub();
    alreadyStopped.killed = true;
    await internals.terminateProcess(alreadyStopped);
    expect(alreadyStopped.kill).not.toHaveBeenCalled();
  });

  it('escalates to SIGKILL when an ffmpeg process ignores graceful termination', async () => {
    const transcoder = new FfmpegMediaTranscoder();
    const internals = transcoder as unknown as { terminateProcess(process: FakeProcess, timeoutMs?: number): Promise<void> };
    const unresponsive = processStub();

    const stopping = internals.terminateProcess(unresponsive, 1_000);
    expect(unresponsive.kill).toHaveBeenCalledWith('SIGTERM');

    await jest.advanceTimersByTimeAsync(1_000);
    expect(unresponsive.kill).toHaveBeenCalledWith('SIGKILL');
    await jest.advanceTimersByTimeAsync(500);
    await stopping;
  });
  it('times out when an HLS manifest exists but has no media segments', async () => {
    const transcoder = new FfmpegMediaTranscoder();
    const internals = transcoder as unknown as { waitForFile(filePath: string, timeoutMs: number): Promise<void> };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('#EXTM3U\\n#EXT-X-VERSION:3');

    const waiting = internals.waitForFile('/tmp/index.m3u8', 500);
    const rejection = expect(waiting).rejects.toThrow('NATIVE_CAMERA_STREAM_TIMEOUT');
    await jest.advanceTimersByTimeAsync(750);

    await rejection;
  });

  it('replaces a stale runtime before starting a fresh HLS writer', async () => {
    const firstProcess = processStub();
    const secondProcess = processStub();
    spawnMock.mockReturnValueOnce(firstProcess).mockReturnValueOnce(secondProcess);
    const transcoder = new FfmpegMediaTranscoder();
    await transcoder.ensureHlsRuntime('camera-1', endpoint);

    firstProcess.killed = true;
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 20_000 });
    await transcoder.ensureHlsRuntime('camera-1', endpoint);

    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it('preserves the stable timeout error when ffmpeg cannot produce an HLS manifest', async () => {
    const process = processStub();
    spawnMock.mockReturnValue(process);
    mockFs.existsSync.mockReturnValue(false);
    const transcoder = new FfmpegMediaTranscoder();
    const started = transcoder.ensureHlsRuntime('camera-timeout', endpoint);
    const rejection = expect(started).rejects.toThrow('NATIVE_CAMERA_STREAM_TIMEOUT');
    process.killed = true;
    await jest.advanceTimersByTimeAsync(8_000);
    await rejection;
  });
  it('restarts a stale native HLS runtime from the health watchdog without concurrent writers', async () => {
    const firstProcess = processStub();
    const restartedProcess = processStub();
    spawnMock.mockReturnValueOnce(firstProcess).mockReturnValueOnce(restartedProcess);
    const transcoder = new FfmpegMediaTranscoder();

    await transcoder.ensureHlsRuntime('camera-watchdog', endpoint);
    firstProcess.killed = true;
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 20_000 });

    await jest.advanceTimersByTimeAsync(5_000);

    expect(spawnMock).toHaveBeenCalledTimes(2);
    transcoder.stopHlsRuntime('camera-watchdog');
  });

  it('removes an exited runtime so the next viewer starts a clean replacement', async () => {
    const firstProcess = processStub();
    const replacementProcess = processStub();
    spawnMock.mockReturnValueOnce(firstProcess).mockReturnValueOnce(replacementProcess);
    const transcoder = new FfmpegMediaTranscoder();

    await transcoder.ensureHlsRuntime('camera-exit', endpoint);
    firstProcess.exitCode = 1;
    firstProcess.emit('exit', 1, null);

    await transcoder.ensureHlsRuntime('camera-exit', endpoint);

    expect(spawnMock).toHaveBeenCalledTimes(2);
    transcoder.stopHlsRuntime('camera-exit');
  });

  it('keeps snapshot errors isolated from the browser response stream', () => {
    const snapshotProcess = processStub();
    spawnMock.mockReturnValue(snapshotProcess);
    const response = new EventEmitter() as EventEmitter & { writeHead: jest.Mock };
    response.writeHead = jest.fn();
    const transcoder = new FfmpegMediaTranscoder();

    transcoder.streamSnapshot(endpoint, response as never);
    snapshotProcess.emit('exit', 1, null);

    expect(snapshotProcess.stdout.pipe).toHaveBeenCalledWith(response);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'image/jpeg' }));
  });
  it('cleans stale HLS files before a new process writes the manifest', async () => {
    const process = processStub();
    spawnMock.mockReturnValue(process);
    mockFs.readdirSync.mockReturnValue(['old.ts', 'index.m3u8']);
    const transcoder = new FfmpegMediaTranscoder();

    await transcoder.ensureHlsRuntime('camera-cleanup', endpoint);

    expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old.ts'));
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('index.m3u8'));
    transcoder.stopHlsRuntime('camera-cleanup');
  });

  it('settles termination exactly once when ffmpeg emits duplicate exit events', async () => {
    const transcoder = new FfmpegMediaTranscoder();
    const internals = transcoder as unknown as { terminateProcess(process: FakeProcess, timeoutMs?: number): Promise<void> };
    const process = processStub();

    const termination = internals.terminateProcess(process, 1_000);
    process.exitCode = 0;
    process.emit('exit', 0, null);
    process.emit('exit', 0, null);

    await expect(termination).resolves.toBeUndefined();
    expect(process.kill).toHaveBeenCalledTimes(1);
  });

  it('does not restart when the watchdog has no runtime or restart already in flight', async () => {
    const transcoder = new FfmpegMediaTranscoder();
    const internals = transcoder as unknown as {
      startHealthWatchdog(deviceId: string): ReturnType<typeof setInterval>;
      restartsInFlight: Set<string>;
    };
    const timer = internals.startHealthWatchdog('camera-idle');

    await jest.advanceTimersByTimeAsync(5_000);
    internals.restartsInFlight.add('camera-idle');
    await jest.advanceTimersByTimeAsync(5_000);

    expect(spawnMock).not.toHaveBeenCalled();
    clearInterval(timer);
  });
});