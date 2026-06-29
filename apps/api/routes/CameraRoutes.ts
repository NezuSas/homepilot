import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { ApiRoutes } from './ApiRoutes';

type CameraMediaKind = 'snapshot' | 'stream';

interface CameraSessionResponse {
  readonly snapshotPath: string;
  readonly streamPath: string;
  readonly hlsPath?: string;
}

interface CameraProxyTokenPayload {
  readonly deviceId: string;
  readonly expiresAt: number;
}

interface CameraHlsProxySession {
  readonly deviceId: string;
  readonly expiresAt: number;
  readonly source: 'home-assistant' | 'native';
  readonly masterPath: string;
  readonly resourcesById: Map<string, string>;
  readonly resourceIdsByPath: Map<string, string>;
  readonly nativeDirectory?: string;
}

const CAMERA_PROXY_TOKEN_TTL_MS = 5 * 60 * 1000;
const NATIVE_CAMERA_HLS_ROOT = path.join(os.tmpdir(), 'homepilot-native-cameras');

interface NativeCameraSourceRow {
  device_id: string;
  host: string;
  rtsp_port: number;
  username: string;
  password: string;
  rtsp_path: string;
  enabled: number;
}

interface NativeHlsRuntime {
  readonly process: ChildProcessWithoutNullStreams;
  readonly directory: string;
  readonly startedAt: number;
}

export class CameraRoutes extends ApiRoutes {
  private readonly hlsSessions = new Map<string, CameraHlsProxySession>();
  private readonly nativeHlsRuntimes = new Map<string, NativeHlsRuntime>();

  constructor(private readonly dbPath?: string) {
    super();
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    const hlsMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/hls\/(master\.m3u8|resource\/([^/]+))$/)
      : null;

    if (hlsMatch) {
      await this.proxyCameraHls(req, res, container, hlsMatch[1], hlsMatch[3]);
      return true;
    }

    const mediaMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/(snapshot|stream)$/)
      : null;

    if (mediaMatch) {
      await this.proxyCameraMedia(req, res, container, mediaMatch[1], mediaMatch[2] as CameraMediaKind);
      return true;
    }

    const sessionMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/session$/)
      : null;

    if (!sessionMatch) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    try {
      const device = await container.repositories.deviceRepository.findDeviceById(sessionMatch[1]);
      const entityId = this.resolveCameraEntityId(device);
      if (!device || !entityId) {
        this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Camera device not found');
        return true;
      }

      if (device.integrationSource === 'native-camera') {
        const nativeSource = this.getNativeCameraSource(device.id);
        if (!nativeSource || nativeSource.enabled !== 1) {
          this.sendError(res, 409, 'CAMERA_UNAVAILABLE', 'Native camera is not configured');
          return true;
        }

        const encodedDeviceId = encodeURIComponent(device.id);
        const cameraProxyToken = this.createCameraProxyToken(device.id);
        const encodedToken = encodeURIComponent(cameraProxyToken);
        const nativeDirectory = await this.ensureNativeHlsRuntime(device, nativeSource);
        this.registerHlsSession(cameraProxyToken, device.id, path.join(nativeDirectory, 'index.m3u8'), 'native', nativeDirectory);
        this.sendJson(res, {
          snapshotPath: `/api/v1/devices/${encodedDeviceId}/camera/snapshot?token=${encodedToken}`,
          streamPath: `/api/v1/devices/${encodedDeviceId}/camera/stream?token=${encodedToken}`,
          hlsPath: `/api/v1/devices/${encodedDeviceId}/camera/hls/master.m3u8?token=${encodedToken}`,
        });
        return true;
      }

      const state = await container.adapters.homeAssistantClient.getEntityState(entityId);
      if (!state || state.state === 'unavailable') {
        this.sendError(res, 409, 'CAMERA_UNAVAILABLE', `Camera ${entityId} is unavailable`);
        return true;
      }

      const encodedDeviceId = encodeURIComponent(device.id);
      const cameraProxyToken = this.createCameraProxyToken(device.id);
      const encodedToken = encodeURIComponent(cameraProxyToken);
      let hlsMasterPath: string | null = null;
      try {
        hlsMasterPath = await container.adapters.homeAssistantClient.getCameraHlsStreamPath(entityId);
      } catch {
        hlsMasterPath = null;
      }

      const response: CameraSessionResponse = {
        snapshotPath: `/api/v1/devices/${encodedDeviceId}/camera/snapshot?token=${encodedToken}`,
        streamPath: `/api/v1/devices/${encodedDeviceId}/camera/stream?token=${encodedToken}`,
        ...(hlsMasterPath
          ? { hlsPath: `/api/v1/devices/${encodedDeviceId}/camera/hls/master.m3u8?token=${encodedToken}` }
          : {}),
      };
      if (hlsMasterPath) this.registerHlsSession(cameraProxyToken, device.id, hlsMasterPath, 'home-assistant');
      this.sendJson(res, response);
    } catch (error: unknown) {
      console.error('[CAMERA_SESSION_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : 'Camera session failed';
      if (errorMessage === 'NATIVE_CAMERA_AUTH_FAILED') {
        this.sendError(res, 400, 'NATIVE_CAMERA_AUTH_FAILED', 'Camera RTSP credentials rejected');
      } else if (errorMessage === 'NATIVE_CAMERA_STREAM_TIMEOUT') {
        this.sendError(res, 502, 'NATIVE_CAMERA_STREAM_TIMEOUT', 'Camera HLS stream timed out');
      } else {
        this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', errorMessage);
      }
    }

    return true;
  }

  private async proxyCameraHls(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
    resourceId?: string,
  ): Promise<void> {
    const requestUrl = new URL(req.url || pathnameFallback('stream', deviceId), 'http://localhost');
    const cameraProxyToken = requestUrl.searchParams.get('token');
    if (!cameraProxyToken || !this.verifyCameraProxyToken(cameraProxyToken, deviceId)) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Invalid camera access token');
      return;
    }

    const session = this.hlsSessions.get(cameraProxyToken);
    if (!session || session.deviceId !== deviceId || session.expiresAt <= Date.now()) {
      this.hlsSessions.delete(cameraProxyToken);
      this.sendError(res, 401, 'CAMERA_SESSION_EXPIRED', 'Camera HLS session expired');
      return;
    }

    const upstreamPath = resourceId ? session.resourcesById.get(resourceId) : session.masterPath;
    if (!upstreamPath) {
      this.sendError(res, 404, 'CAMERA_HLS_RESOURCE_NOT_FOUND', 'Camera HLS resource not found');
      return;
    }

    if (session.source === 'native') {
      await this.serveNativeHlsResource(res, session, upstreamPath);
      return;
    }

    const abortController = new AbortController();
    const abortUpstream = () => abortController.abort();
    res.once('close', abortUpstream);

    try {
      const upstream = await container.adapters.homeAssistantClient.getCameraHlsMedia(
        upstreamPath,
        abortController.signal,
      );
      if (!upstream.ok || !upstream.body) {
        this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', `Home Assistant HLS response ${upstream.status}`);
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      const isManifest = upstreamPath.split('?')[0].endsWith('.m3u8')
        || contentType.includes('mpegurl')
        || contentType.includes('mpegURL');

      if (isManifest) {
        const manifest = await upstream.text();
        const rewrittenManifest = this.rewriteHlsManifest(
          manifest,
          upstreamPath,
          session,
          cameraProxyToken,
        );
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(rewrittenManifest);
        return;
      }

      const headers: http.OutgoingHttpHeaders = {
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      };
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) headers['Content-Length'] = contentLength;
      res.writeHead(200, headers);

      const reader = upstream.body.getReader();
      while (!res.destroyed) {
        const chunk = await reader.read();
        if (chunk.done) break;
        res.write(chunk.value);
      }
      if (!res.destroyed) res.end();
    } catch (error: unknown) {
      console.error('[CameraRoutes] proxyCameraHls critical error:', error);
      if (abortController.signal.aborted || res.destroyed) return;
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera HLS proxy failed');
    } finally {
      res.off('close', abortUpstream);
    }
  }

  private async proxyCameraMedia(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
    kind: CameraMediaKind,
  ): Promise<void> {
    const requestUrl = new URL(req.url || pathnameFallback(kind, deviceId), 'http://localhost');
    const cameraProxyToken = requestUrl.searchParams.get('token');
    if (!cameraProxyToken) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Missing camera access token');
      return;
    }

    if (!this.verifyCameraProxyToken(cameraProxyToken, deviceId)) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Invalid camera access token');
      return;
    }

    const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
    const entityId = this.resolveCameraEntityId(device);
    if (!device || !entityId) {
      this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Camera device not found');
      return;
    }

    if (device.integrationSource === 'native-camera') {
      const nativeSource = this.getNativeCameraSource(device.id);
      if (!nativeSource || nativeSource.enabled !== 1) {
        this.sendError(res, 409, 'CAMERA_UNAVAILABLE', 'Native camera is not configured');
        return;
      }
      if (kind === 'snapshot') {
        this.serveNativeCameraSnapshot(res, nativeSource);
        return;
      }
      if (kind === 'stream') {
        this.serveNativeCameraStream(res, nativeSource);
        return;
      }
      this.sendError(res, 400, 'INVALID_MEDIA_KIND', `Unsupported media kind: ${kind}`);
      return;
    }

    const abortController = new AbortController();
    const abortUpstream = () => abortController.abort();
    res.once('close', abortUpstream);

    try {
      const upstream = await container.adapters.homeAssistantClient.getCameraMedia(
        entityId,
        kind,
        abortController.signal,
      );

      if (!upstream.ok || !upstream.body) {
        this.sendError(
          res,
          upstream.status === 401 || upstream.status === 403 ? 401 : 502,
          upstream.status === 401 || upstream.status === 403 ? 'UNAUTHORIZED' : 'CAMERA_MEDIA_ERROR',
          `Home Assistant camera response ${upstream.status}`,
        );
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.startsWith('image/') && !contentType.startsWith('multipart/x-mixed-replace')) {
        this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', `Unexpected camera content type: ${contentType}`);
        return;
      }

      const headers: http.OutgoingHttpHeaders = {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      };
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) headers['Content-Length'] = contentLength;
      res.writeHead(200, headers);

      const reader = upstream.body.getReader();
      while (!res.destroyed) {
        const chunk = await reader.read();
        if (chunk.done) break;
        res.write(chunk.value);
      }
      if (!res.destroyed) res.end();
    } catch (error: unknown) {
      if (abortController.signal.aborted || res.destroyed) return;
      this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', error instanceof Error ? error.message : 'Camera proxy failed');
    } finally {
      res.off('close', abortUpstream);
    }
  }

  private resolveCameraEntityId(device: Device | null): string | null {
    if (!device) return null;
    if (device.integrationSource === 'native-camera' && device.type === 'camera') return 'native';
    if (!device.externalId.startsWith('ha:camera.')) return null;
    return device.externalId.slice(3);
  }

  private createCameraProxyToken(deviceId: string): string {
    const payload: CameraProxyTokenPayload = {
      deviceId,
      expiresAt: Date.now() + CAMERA_PROXY_TOKEN_TTL_MS,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.signCameraProxyPayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private registerHlsSession(
    token: string,
    deviceId: string,
    masterPath: string,
    source: CameraHlsProxySession['source'],
    nativeDirectory?: string,
  ): void {
    this.removeExpiredHlsSessions();
    this.hlsSessions.set(token, {
      deviceId,
      expiresAt: Date.now() + CAMERA_PROXY_TOKEN_TTL_MS,
      source,
      masterPath,
      resourcesById: new Map<string, string>(),
      resourceIdsByPath: new Map<string, string>(),
      nativeDirectory,
    });
  }

  private getNativeCameraSource(deviceId: string): NativeCameraSourceRow | null {
    if (!this.dbPath) return null;
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    const row = db.prepare('SELECT * FROM native_camera_sources WHERE device_id = ?').get(deviceId) as NativeCameraSourceRow | undefined;
    return row || null;
  }

  private async ensureNativeHlsRuntime(device: Device, source: NativeCameraSourceRow): Promise<string> {
    const existing = this.nativeHlsRuntimes.get(device.id);
    const indexPath = existing ? path.join(existing.directory, 'index.m3u8') : '';
    if (existing && !existing.process.killed && fs.existsSync(indexPath)) return existing.directory;

    if (existing) this.stopNativeHlsRuntime(device.id);

    const directory = path.join(NATIVE_CAMERA_HLS_ROOT, device.id);
    fs.mkdirSync(directory, { recursive: true });
    for (const file of fs.readdirSync(directory)) {
      fs.unlinkSync(path.join(directory, file));
    }

    const process = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-rtsp_transport',
      'tcp',
      '-probesize',
      '32768',
      '-analyzeduration',
      '100000',
      '-i',
      this.buildNativeRtspUrl(source),
      '-an',
      '-c:v',
      'copy',
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '6',
      '-hls_flags',
      'delete_segments+append_list',
      '-hls_segment_filename',
      path.join(directory, 'segment-%05d.ts'),
      path.join(directory, 'index.m3u8'),
    ]);

    let ffmpegStderr = '';
    process.stderr.on('data', (chunk: Buffer) => {
      ffmpegStderr += chunk.toString();
    });

    process.on('exit', () => {
      const current = this.nativeHlsRuntimes.get(device.id);
      if (current?.process === process) this.nativeHlsRuntimes.delete(device.id);
    });

    this.nativeHlsRuntimes.set(device.id, { process, directory, startedAt: Date.now() });
    try {
      await this.waitForFile(path.join(directory, 'index.m3u8'), 8000);
    } catch (err) {
      this.stopNativeHlsRuntime(device.id);
      if (ffmpegStderr.includes('401') || ffmpegStderr.toLowerCase().includes('unauthorized') || ffmpegStderr.toLowerCase().includes('authorization failed')) {
        console.error(`[CameraRoutes] ffmpeg 401 Unauthorized for device ${device.id}. Check camera credentials.`);
        throw new Error('NATIVE_CAMERA_AUTH_FAILED');
      }
      console.error(`[CameraRoutes] ffmpeg failed for device ${device.id}: ${ffmpegStderr.slice(-300)}`);
      throw err;
    }
    return directory;
  }

  private stopNativeHlsRuntime(deviceId: string): void {
    const runtime = this.nativeHlsRuntimes.get(deviceId);
    if (!runtime) return;
    runtime.process.kill('SIGTERM');
    this.nativeHlsRuntimes.delete(deviceId);
  }

  private buildNativeRtspUrl(source: NativeCameraSourceRow): string {
    const rtspPath = source.rtsp_path.startsWith('/') ? source.rtsp_path : `/${source.rtsp_path}`;
    const hasEmbeddedCreds = rtspPath.toLowerCase().includes('username=') || 
                             rtspPath.toLowerCase().includes('password=') || 
                             rtspPath.toLowerCase().includes('user=') || 
                             rtspPath.toLowerCase().includes('pwd=');
    if (hasEmbeddedCreds) {
      return `rtsp://${source.host}:${source.rtsp_port}${rtspPath}`;
    }
    const username = encodeURIComponent(source.username);
    const password = encodeURIComponent(source.password);
    return `rtsp://${username}:${password}@${source.host}:${source.rtsp_port}${rtspPath}`;
  }

  private serveNativeCameraSnapshot(res: http.ServerResponse, source: NativeCameraSourceRow): void {
    const rtspUrl = this.buildNativeRtspUrl(source);
    const process = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-vframes',
      '1',
      '-f',
      'image2',
      '-',
    ]);

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
    });

    process.stdout.pipe(res);
    process.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[CameraRoutes] ffmpeg snapshot exit code ${code}`);
      }
    });
  }

  private serveNativeCameraStream(res: http.ServerResponse, source: NativeCameraSourceRow): void {
    const rtspUrl = this.buildNativeRtspUrl(source);
    const process = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-c:v',
      'mjpeg',
      '-f',
      'mpjpeg',
      '-',
    ]);

    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--ffmpeg',
      'Cache-Control': 'no-store, max-age=0',
    });

    process.stdout.pipe(res);
    res.on('close', () => {
      process.kill('SIGTERM');
    });
  }

  private async waitForFile(filePath: string, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (fs.existsSync(filePath)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('NATIVE_CAMERA_STREAM_TIMEOUT');
  }

  private async serveNativeHlsResource(
    res: http.ServerResponse,
    session: CameraHlsProxySession,
    filePath: string | undefined,
  ): Promise<void> {
    if (!filePath || !session.nativeDirectory) {
      this.sendError(res, 404, 'CAMERA_HLS_RESOURCE_NOT_FOUND', 'Camera HLS resource not found');
      return;
    }

    const resolvedFilePath = path.resolve(filePath);
    const resolvedDirectory = path.resolve(session.nativeDirectory);
    if (!resolvedFilePath.startsWith(resolvedDirectory) || !fs.existsSync(resolvedFilePath)) {
      this.sendError(res, 404, 'CAMERA_HLS_RESOURCE_NOT_FOUND', 'Camera HLS resource not found');
      return;
    }

    if (resolvedFilePath.endsWith('.m3u8')) {
      const manifest = fs.readFileSync(resolvedFilePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          const resourceId = path.basename(trimmed);
          session.resourcesById.set(resourceId, path.join(resolvedDirectory, resourceId));
          return `/api/v1/devices/${encodeURIComponent(session.deviceId)}/camera/hls/resource/${encodeURIComponent(resourceId)}?token=${this.currentTokenForSession(session)}`;
        })
        .join('\n');
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(manifest);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(resolvedFilePath).pipe(res);
  }

  private currentTokenForSession(targetSession: CameraHlsProxySession): string {
    for (const [token, session] of this.hlsSessions) {
      if (session === targetSession) return encodeURIComponent(token);
    }
    return '';
  }

  private rewriteHlsManifest(
    manifest: string,
    currentUpstreamPath: string,
    session: CameraHlsProxySession,
    token: string,
  ): string {
    const rewriteUri = (uri: string): string => {
      if (!uri || uri.startsWith('data:')) return uri;
      const upstreamPath = this.resolveHlsPath(currentUpstreamPath, uri);
      let resourceId = session.resourceIdsByPath.get(upstreamPath);
      if (!resourceId) {
        if (session.resourcesById.size >= 1024) throw new Error('CAMERA_HLS_RESOURCE_LIMIT');
        resourceId = crypto.randomBytes(12).toString('base64url');
        session.resourcesById.set(resourceId, upstreamPath);
        session.resourceIdsByPath.set(upstreamPath, resourceId);
      }
      return `/api/v1/devices/${encodeURIComponent(session.deviceId)}/camera/hls/resource/${resourceId}?token=${encodeURIComponent(token)}`;
    };

    return manifest
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (!trimmed.startsWith('#')) return rewriteUri(trimmed);
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${rewriteUri(uri)}"`);
      })
      .join('\n');
  }

  private resolveHlsPath(currentPath: string, uri: string): string {
    const proxyOrigin = 'http://homeassistant.local';
    const resolved = new URL(uri, new URL(currentPath, proxyOrigin));
    if (resolved.origin !== proxyOrigin || !resolved.pathname.startsWith('/api/hls/')) {
      throw new Error('CAMERA_HLS_RESOURCE_INVALID');
    }
    return `${resolved.pathname}${resolved.search}`;
  }

  private removeExpiredHlsSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.hlsSessions) {
      if (session.expiresAt <= now) this.hlsSessions.delete(token);
    }
  }

  private verifyCameraProxyToken(token: string, deviceId: string): boolean {
    const [encodedPayload, providedSignature] = token.split('.');
    if (!encodedPayload || !providedSignature) return false;

    const expectedSignature = this.signCameraProxyPayload(encodedPayload);
    if (!this.tokensMatch(providedSignature, expectedSignature)) return false;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as CameraProxyTokenPayload;
      return payload.deviceId === deviceId && Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now();
    } catch {
      return false;
    }
  }

  private signCameraProxyPayload(encodedPayload: string): string {
    const secret = process.env.CAMERA_PROXY_SIGNING_SECRET
      || process.env.HOME_ASSISTANT_TOKEN
      || 'homepilot-camera-proxy-development-secret';
    return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  }

  private tokensMatch(providedToken: string, expectedToken: string): boolean {
    const provided = Buffer.from(providedToken);
    const expected = Buffer.from(expectedToken);
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  }
}

function pathnameFallback(kind: CameraMediaKind, deviceId: string): string {
  return `/api/v1/devices/${encodeURIComponent(deviceId)}/camera/${kind}`;
}
