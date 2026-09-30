import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';
import { SettingsRoutes } from '../routes/SettingsRoutes';

const ENDPOINT = '/api/v1/settings/home-personalization';

function request(payload?: unknown): HomePilotRequest {
  const value = new EventEmitter() as HomePilotRequest;
  value.headers = { host: 'localhost' };
  value._fastifyParsedBody = payload === undefined ? undefined : JSON.stringify(payload);
  return value;
}

function response() {
  return { writeHead: jest.fn(), end: jest.fn(), setHeader: jest.fn() };
}

function container(admin = true): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(admin) } },
    services: { systemVariableService: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) } },
  } as unknown as BootstrapContainer;
}

describe('Feature: global Home personalization API', () => {
  let mediaDirectory: string;
  let routes: SettingsRoutes;
  beforeEach(async () => {
    mediaDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'homepilot-home-settings-'));
    routes = new SettingsRoutes(new MediaService(mediaDirectory));
  });
  afterEach(async () => { await fs.rm(mediaDirectory, { recursive: true, force: true }); });

  it('allows authenticated reads with empty phrases and no custom image', async () => {
    const target = container(false);
    const reply = response();
    await routes.handle(request(), reply as unknown as http.ServerResponse, ENDPOINT, 'GET', target);
    expect(JSON.parse(reply.end.mock.calls[0][0])).toMatchObject({ morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] });
    expect(target.guards.authGuard.requireRole).not.toHaveBeenCalled();
  });

  it('allows an Admin to save 1000 characters per phrase but rejects 1001', async () => {
    const target = container();
    const phrases = { morningPhrase: 'Mañana', afternoonPhrase: 'Tarde', nightPhrase: 'Noche' };
    await routes.handle(request(phrases), response() as unknown as http.ServerResponse, ENDPOINT, 'PUT', target);
    expect(target.services.systemVariableService.set).toHaveBeenCalledWith(expect.objectContaining({ scope: 'global', name: 'home_personalization_phrases', value: JSON.stringify(phrases) }));
    const boundary = { ...phrases, morningPhrase: 'x'.repeat(1000) };
    await routes.handle(request(boundary), response() as unknown as http.ServerResponse, ENDPOINT, 'PUT', target);
    expect(target.services.systemVariableService.set).toHaveBeenCalledWith(expect.objectContaining({ value: JSON.stringify(boundary) }));

    const reply = response();
    await routes.handle(request({ ...phrases, nightPhrase: 'x'.repeat(1001) }), reply as unknown as http.ServerResponse, ENDPOINT, 'PUT', target);
    expect(reply.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(target.services.systemVariableService.set).toHaveBeenCalledTimes(2);
  });

  it('never persists arbitrary extra fields or binary payloads with the phrases', async () => {
    const target = container();
    const phrases = { morningPhrase: '', afternoonPhrase: '', nightPhrase: '' };
    await routes.handle(request({ ...phrases, heroImages: ['data:image/png;base64,binary'] }), response() as unknown as http.ServerResponse, ENDPOINT, 'PUT', target);
    expect(target.services.systemVariableService.set).toHaveBeenCalledWith(expect.objectContaining({ value: JSON.stringify(phrases) }));
  });

  it('reads saved global phrases again after a new route instance is created', async () => {
    const target = container();
    const phrases = { morningPhrase: 'Buenos días', afternoonPhrase: 'Buenas tardes', nightPhrase: 'Buenas noches' };
    (target.services.systemVariableService.set as jest.Mock).mockImplementation(async ({ value }: { value: string }) => {
      (target.services.systemVariableService.get as jest.Mock).mockResolvedValue({ value });
    });
    await routes.handle(request(phrases), response() as unknown as http.ServerResponse, ENDPOINT, 'PUT', target);
    const reloaded = new SettingsRoutes(new MediaService(mediaDirectory));
    const reply = response();
    await reloaded.handle(request(), reply as unknown as http.ServerResponse, ENDPOINT, 'GET', target);
    expect(JSON.parse(reply.end.mock.calls[0][0])).toMatchObject(phrases);
  });

  it('does not let a non-Admin save phrases or upload images', async () => {
    const target = container(false);
    const phrases = { morningPhrase: '', afternoonPhrase: '', nightPhrase: '' };
    await routes.handle(request(phrases), response() as unknown as http.ServerResponse, ENDPOINT, 'PUT', target);
    await routes.handle(request({ dataUri: 'data:image/png;base64,aGVsbG8=' }), response() as unknown as http.ServerResponse, `${ENDPOINT}/images`, 'POST', target);
    expect(target.guards.authGuard.requireRole).toHaveBeenCalledTimes(2);
    expect(target.services.systemVariableService.set).not.toHaveBeenCalled();
    expect(await fs.readdir(mediaDirectory)).toEqual([]);
  });
});
