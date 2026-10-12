import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { captureRtspFrame, classifyFfmpegOutput, readStreamDetails, type SpawnFfmpeg } from '../infrastructure/FfmpegFrameProbe';

const endpoint = { host: '192.168.1.50', rtspPort: 554, rtspPath: '/stream1', username: 'admin', password: 'p@ss/word' };

/** A fake ffmpeg process that plays a script, so the probe is tested without any camera or binary. */
function fakeFfmpeg(script: (child: { stdout: EventEmitter; stderr: EventEmitter; emitClose: () => void }) => void): { spawn: SpawnFfmpeg; args: () => string[]; killed: () => boolean } {
  let captured: string[] = [];
  let wasKilled = false;
  const spawn: SpawnFfmpeg = (args) => {
    captured = args;
    const emitter = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    Object.assign(emitter, { stdout, stderr, kill: () => { wasKilled = true; setImmediate(() => emitter.emit('close', null)); return true; } });
    setImmediate(() => script({ stdout, stderr, emitClose: () => emitter.emit('close', 0) }));
    return emitter;
  };
  return { spawn, args: () => captured, killed: () => wasKilled };
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

describe('Feature: telling why a camera did not answer', () => {
  it.each([
    ['rtsp://admin:***@192.168.1.50:554/stream1: Server returned 401 Unauthorized (authorization failed)', 'UNAUTHORIZED'],
    ['method DESCRIBE failed: 401 Unauthorized', 'UNAUTHORIZED'],
    ['Server returned 403 Forbidden (access denied)', 'UNAUTHORIZED'],
    ['method DESCRIBE failed: 404 Not Found', 'NOT_FOUND'],
    ['Connection to tcp://192.168.1.50:554?timeout=0 failed: Connection refused', 'CONNECTION_REFUSED'],
    ['Connection to tcp://192.168.1.50:554 failed: No route to host', 'UNREACHABLE'],
    ['Connection to tcp://10.9.9.9:554 failed: Network is unreachable', 'UNREACHABLE'],
    ['Connection to tcp://192.168.1.50:554 failed: Connection timed out', 'UNREACHABLE'],
    ['Could not resolve hostname cam.local: Name or service not known', 'UNREACHABLE'],
    ['Invalid data found when processing input', 'NO_VIDEO'],
    ['Could not find codec parameters for stream 0 (Video: hevc, none): unspecified size', 'NO_VIDEO'],
    ['something nobody has seen before', 'FAILED'],
    ['', 'FAILED'],
  ] as const)('Scenario: Given the log "%s" When classified Then it is %s', (log, expected) => {
    expect(classifyFfmpegOutput(log)).toBe(expected);
  });

  it('Scenario: Given both a refusal and a not-found line When classified Then the credentials problem wins over a guess about the path', () => {
    expect(classifyFfmpegOutput('404 Not Found\n401 Unauthorized')).toBe('UNAUTHORIZED');
  });
});

describe('Feature: reading what the camera sends', () => {
  it('Scenario: Given a typical ffmpeg stream line When read Then codec and resolution come out', () => {
    expect(readStreamDetails('  Stream #0:0: Video: h264 (High), yuv420p(tv, bt709, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 25 fps, 25 tbr'))
      .toEqual({ codec: 'h264', width: 1920, height: 1080 });
  });

  it('Scenario: Given a stream line without a size When read Then only the codec is known', () => {
    expect(readStreamDetails('Stream #0:0: Video: hevc, none')).toEqual({ codec: 'hevc', width: null, height: null });
  });

  it('Scenario: Given no video line When read Then nothing is known', () => {
    expect(readStreamDetails('Input #0, rtsp, from ...')).toEqual({ codec: null, width: null, height: null });
  });
});

describe('Feature: grabbing one frame from a camera', () => {
  it('Scenario: Given a camera that answers When a frame is captured Then the JPEG and the stream details come back', async () => {
    const fake = fakeFfmpeg(({ stdout, stderr, emitClose }) => {
      stderr.emit('data', Buffer.from('Stream #0:0: Video: h264 (Main), yuv420p, 1280x720, 15 fps\n'));
      stdout.emit('data', JPEG);
      emitClose();
    });

    const result = await captureRtspFrame(endpoint, 5000, fake.spawn);

    expect(result).toEqual({ ok: true, jpeg: JPEG, codec: 'h264', width: 1280, height: 720 });
  });

  it('Scenario: Given the camera address When ffmpeg is started Then it reads over TCP, takes one frame and never records audio', async () => {
    const fake = fakeFfmpeg(({ stdout, emitClose }) => { stdout.emit('data', JPEG); emitClose(); });

    await captureRtspFrame(endpoint, 5000, fake.spawn);

    const args = fake.args();
    expect(args).toEqual(expect.arrayContaining(['-rtsp_transport', 'tcp', '-an', '-frames:v', '1', 'pipe:1']));
    expect(args[args.indexOf('-i') + 1]).toBe('rtsp://admin:p%40ss%2Fword@192.168.1.50:554/stream1');
  });

  it('Scenario: Given a camera that rejects the credentials When a frame is captured Then the reason is UNAUTHORIZED and no frame is returned', async () => {
    const fake = fakeFfmpeg(({ stderr, emitClose }) => { stderr.emit('data', Buffer.from('method DESCRIBE failed: 401 Unauthorized\n')); emitClose(); });

    expect(await captureRtspFrame(endpoint, 5000, fake.spawn)).toEqual({ ok: false, reason: 'UNAUTHORIZED' });
  });

  it('Scenario: Given a camera that never answers When the time runs out Then ffmpeg is stopped and the reason is TIMEOUT', async () => {
    const fake = fakeFfmpeg(() => { /* silence */ });

    expect(await captureRtspFrame(endpoint, 30, fake.spawn)).toEqual({ ok: false, reason: 'TIMEOUT' });
    expect(fake.killed()).toBe(true);
  });

  it('Scenario: Given output that is not a JPEG When a frame is captured Then it is not accepted as a frame', async () => {
    const fake = fakeFfmpeg(({ stdout, stderr, emitClose }) => { stderr.emit('data', Buffer.from('Invalid data found when processing input\n')); stdout.emit('data', Buffer.from('not an image')); emitClose(); });

    expect(await captureRtspFrame(endpoint, 5000, fake.spawn)).toEqual({ ok: false, reason: 'NO_VIDEO' });
  });

  it('Scenario: Given ffmpeg that cannot even start When a frame is captured Then it fails cleanly', async () => {
    const spawn: SpawnFfmpeg = () => {
      const emitter = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
      Object.assign(emitter, { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => true });
      setImmediate(() => emitter.emit('error', new Error('spawn ffmpeg ENOENT')));
      return emitter;
    };

    expect(await captureRtspFrame(endpoint, 5000, spawn)).toEqual({ ok: false, reason: 'FAILED' });
  });

  it('Scenario: Given a runaway output When it exceeds the size cap Then ffmpeg is stopped and no frame is accepted', async () => {
    const fake = fakeFfmpeg(({ stdout }) => { stdout.emit('data', Buffer.alloc(4 * 1024 * 1024, 0xff)); });

    const result = await captureRtspFrame(endpoint, 5000, fake.spawn);

    expect(result.ok).toBe(false);
    expect(fake.killed()).toBe(true);
  });
});
