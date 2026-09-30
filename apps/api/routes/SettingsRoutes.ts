import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';

const HOME_PHRASES_KEY = 'home_personalization_phrases';
type HomePhrases = { morningPhrase: string; afternoonPhrase: string; nightPhrase: string };

function validPhrases(value: unknown): value is HomePhrases {
  if (!value || typeof value !== 'object') return false;
  const phrases = value as Record<string, unknown>;
  return ['morningPhrase', 'afternoonPhrase', 'nightPhrase'].every(
    (key) => typeof phrases[key] === 'string' && phrases[key].length <= 1000,
  );
}

/**
 * Settings routes: /api/v1/settings/*
 */
export class SettingsRoutes extends ApiRoutes {
  constructor(private readonly mediaService: MediaService) { super(); }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/settings/')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    if (pathname === '/api/v1/settings/home-personalization' && method === 'GET') {
      const variable = await container.services.systemVariableService.get('global', null, HOME_PHRASES_KEY);
      const stored: unknown = variable ? JSON.parse(variable.value) : null;
      const phrases: HomePhrases = validPhrases(stored) ? stored : { morningPhrase: '', afternoonPhrase: '', nightPhrase: '' };
      this.sendJson(res, { ...phrases, heroImages: await this.mediaService.listHomeImages() });
      return true;
    }

    if (pathname === '/api/v1/settings/home-personalization' && method === 'PUT') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      const payload: unknown = await this.parseBody<unknown>(req);
      if (!validPhrases(payload)) return this.sendError(res, 400, 'VALIDATION_ERROR', 'Each phrase must be at most 1000 characters'), true;
      const phrases: HomePhrases = {
        morningPhrase: payload.morningPhrase,
        afternoonPhrase: payload.afternoonPhrase,
        nightPhrase: payload.nightPhrase,
      };
      await container.services.systemVariableService.set({
        scope: 'global', name: HOME_PHRASES_KEY, value: JSON.stringify(phrases), valueType: 'json',
      });
      this.sendJson(res, { ...phrases, heroImages: await this.mediaService.listHomeImages() });
      return true;
    }

    if (pathname === '/api/v1/settings/home-personalization/images' && method === 'POST') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      const payload = await this.parseBody<{ dataUri?: unknown }>(req);
      if (typeof payload?.dataUri !== 'string') return this.sendError(res, 400, 'VALIDATION_ERROR', 'Image is required'), true;
      try {
        this.sendJson(res, { heroImages: await this.mediaService.addHomeImage(payload.dataUri) });
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'HOME_IMAGE_LIMIT') return this.sendError(res, 409, code, 'Maximum five images'), true;
        if (['Invalid image data URI', 'Unsupported image type', 'Image exceeds allowed size', 'Invalid image payload'].includes(code)) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', code), true;
        }
        throw error;
      }
      return true;
    }

    const homeImageDelete = /^\/api\/v1\/settings\/home-personalization\/images\/([1-5])$/.exec(pathname);
    if (homeImageDelete && method === 'DELETE') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        this.sendJson(res, { heroImages: await this.mediaService.deleteHomeImage(Number(homeImageDelete[1])) });
      } catch (error) {
        if (error instanceof Error && error.message === 'HOME_IMAGE_NOT_FOUND') {
          return this.sendError(res, 404, 'NOT_FOUND', 'Home image not found'), true;
        }
        throw error;
      }
      return true;
    }

    // POST /api/v1/settings/home-assistant/test (canonical) and legacy test-ha-connection
    if (method === 'POST' && (pathname === '/api/v1/settings/home-assistant/test' || pathname === '/api/v1/settings/test-ha-connection')) {
      try {
        const payload = await this.parseBody<{ baseUrl?: string; accessToken?: string }>(req);
        if (!payload.baseUrl || !payload.accessToken) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'baseUrl and accessToken are required'), true;
        }

        const result = await container.services.homeAssistantSettingsService.testConnection(
          payload.baseUrl,
          payload.accessToken
        );

        this.sendJson(res, {
          success: result.success,
          status: result.status,
          ...(result.success ? {} : { error: { code: result.status.toUpperCase(), message: result.error || 'Connection failed' } }),
        });
      } catch {
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to test connection');
      }
      return true;
    }

    // POST /api/v1/settings/home-assistant
    if (method === 'POST' && pathname === '/api/v1/settings/home-assistant') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;

      try {
        const payload = await this.parseBody<{ baseUrl?: string; accessToken?: string }>(req);
        if (!payload.baseUrl) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'baseUrl is required'), true;
        }

        await container.services.homeAssistantSettingsService.saveSettings(payload.baseUrl, payload.accessToken);
        this.sendJson(res, { success: true });
      } catch (e: unknown) {
        const msg = (e instanceof Error ? e.message : String(e)) || '';
        if (msg.includes('Invalid URL')) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'Invalid Home Assistant URL'), true;
        }
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to save Home Assistant settings');
      }
      return true;
    }

    // GET /api/v1/settings/home-assistant
    if (method === 'GET' && pathname === '/api/v1/settings/home-assistant') {
      try {
        const status = await container.services.homeAssistantSettingsService.getStatus();
        const { ...safeStatus } = status;
        this.sendJson(res, safeStatus);
      } catch {
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to get Home Assistant settings');
      }
      return true;
    }
    // GET /api/v1/settings/home-assistant/status
    if (method === 'GET' && pathname === '/api/v1/settings/home-assistant/status') {
      try {
        const status = await container.services.homeAssistantSettingsService.getStatus();
        this.sendJson(res, {
          connectivityStatus: status.connectivityStatus,
          lastCheckedAt: status.lastCheckedAt,
        });
      } catch {
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to get Home Assistant connection status');
      }
      return true;
    }

    return false;
  }
}
