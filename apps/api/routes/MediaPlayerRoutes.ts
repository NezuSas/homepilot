import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ApiRoutes } from './ApiRoutes';

interface ArtworkSessionPayload {
  readonly deviceId: string;
  readonly artworkPath: string;
  readonly expiresAt: number;
}

const ARTWORK_TOKEN_TTL_MS = 30 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveArtworkPath(device: Device | null): string | null {
  if (!device || device.type !== 'media_player') return null;
  const state = asRecord(device.lastKnownState);
  const attributes = asRecord(state.attributes);
  const artworkPath = attributes.entity_picture_local
    ?? attributes.entity_picture
    ?? state.entity_picture_local
    ?? state.entity_picture;
  if (typeof artworkPath !== 'string' || !artworkPath.trim()) return null;

  const normalizedPath = artworkPath.trim();
  if (!normalizedPath.startsWith('/api/media_player_proxy/')) return normalizedPath;

  const localArtworkUrl = new URL(normalizedPath, 'http://homepilot.local');
  localArtworkUrl.searchParams.delete('token');
  return `${localArtworkUrl.pathname}${localArtworkUrl.search}`;
}

export class MediaPlayerRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    const sessionMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/media\/session$/)
      : null;
    if (sessionMatch) {
      await this.createArtworkSession(req, res, container, sessionMatch[1]);
      return true;
    }

    const artworkMatch = method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/media\/artwork$/)
      : null;
    if (artworkMatch) {
      await this.proxyArtwork(req, res, container, artworkMatch[1]);
      return true;
    }

    return false;
  }

  private async createArtworkSession(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
  ): Promise<void> {
    if (!await container.guards.authGuard.protect(req, res, true)) return;

    const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
    const artworkPath = resolveArtworkPath(device);
    if (!device || device.type !== 'media_player') {
      this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Media player not found');
      return;
    }

    if (!artworkPath) {
      this.sendJson(res, { artworkPath: null });
      return;
    }

    const token = this.createArtworkToken({ deviceId, artworkPath, expiresAt: Date.now() + ARTWORK_TOKEN_TTL_MS });
    this.sendJson(res, {
      artworkPath: `/api/v1/devices/${encodeURIComponent(deviceId)}/media/artwork?token=${encodeURIComponent(token)}`,
    });
  }

  private async proxyArtwork(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer,
    deviceId: string,
  ): Promise<void> {
    const requestUrl = new URL(req.url || `/api/v1/devices/${encodeURIComponent(deviceId)}/media/artwork`, 'http://localhost');
    const payload = this.readArtworkToken(requestUrl.searchParams.get('token'), deviceId);
    if (!payload) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Invalid artwork token');
      return;
    }

    const abortController = new AbortController();
    const abortUpstream = () => abortController.abort();
    res.once('close', abortUpstream);
    try {
      const upstream = await container.adapters.homeAssistantClient.getMediaArtwork(payload.artworkPath, abortController.signal);
      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !upstream.body || !contentType.startsWith('image/')) {
        this.sendError(res, 502, 'HA_CONNECTION_ERROR', `Media artwork response ${upstream.status}`);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      });
      const reader = upstream.body.getReader();
      while (!res.destroyed) {
        const chunk = await reader.read();
        if (chunk.done) break;
        res.write(chunk.value);
      }
      if (!res.destroyed) res.end();
    } catch (error: unknown) {
      if (!abortController.signal.aborted && !res.destroyed) {
        this.sendError(res, 502, 'HA_CONNECTION_ERROR', error instanceof Error ? error.message : 'Media artwork proxy failed');
      }
    } finally {
      res.off('close', abortUpstream);
    }
  }

  private createArtworkToken(payload: ArtworkSessionPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  private readArtworkToken(token: string | null, deviceId: string): ArtworkSessionPayload | null {
    if (!token) return null;
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature || !this.matches(signature, this.sign(encodedPayload))) return null;
    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as ArtworkSessionPayload;
      return payload.deviceId === deviceId && payload.expiresAt > Date.now() && typeof payload.artworkPath === 'string'
        ? payload
        : null;
    } catch {
      return null;
    }
  }

  private sign(value: string): string {
    const secret = process.env.MEDIA_ARTWORK_SIGNING_SECRET
      || process.env.HOME_ASSISTANT_TOKEN
      || 'homepilot-media-artwork-development-secret';
    return crypto.createHmac('sha256', secret).update(value).digest('base64url');
  }

  private matches(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
