import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { NativeCameraRoutes } from '../routes/NativeCameraRoutes';
import type { NativeCameraService } from '../../../packages/integrations/native-camera/application/NativeCameraService';
import type { CameraTestResult } from '../../../packages/integrations/native-camera/application/NativeCameraConnectionTester';

describe('Feature: POST /api/v1/native-cameras/test', () => {
  const nativeCameraService = { create: jest.fn(), update: jest.fn(), delete: jest.fn(), listByHome: jest.fn(), discover: jest.fn() };
  const routes = new NativeCameraRoutes(nativeCameraService as unknown as NativeCameraService);
  const response = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;
  const body = { sourceType: 'rtsp-dvr', host: '192.168.1.50', username: 'admin', password: 'hunter2-secret', rtspPath: '/stream1' };
  const request = (payload: unknown = body) => ({ url: '/api/v1/native-cameras/test', headers: {}, _fastifyParsedBody: JSON.stringify(payload) }) as unknown as HomePilotRequest;

  function container(result: CameraTestResult | Error, options: { authenticated?: boolean; admin?: boolean } = {}) {
    const test = jest.fn(async () => { if (result instanceof Error) throw result; return result; });
    const requireRole = jest.fn().mockReturnValue(options.admin ?? true);
    const built = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(options.authenticated ?? true), requireRole } },
      services: { nativeCameraConnectionTester: { test } },
    } as unknown as BootstrapContainer;
    return { built, test, requireRole };
  }
  const sent = (res: http.ServerResponse) => JSON.parse((res.end as jest.Mock).mock.calls[0][0] as string) as Record<string, unknown>;

  beforeEach(() => jest.clearAllMocks());

  it('Scenario: Given an unauthenticated request When it is sent Then nothing is tested and nothing is answered', async () => {
    const { built, test } = container({ ok: false, error: { code: 'TIMEOUT', message: 'm', hint: 'h' } }, { authenticated: false });
    const res = response();

    await routes.handle(request(), res, '/api/v1/native-cameras/test', 'POST', built);

    expect(test).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('Scenario: Given a user below administrator When it is sent Then the camera is never contacted', async () => {
    const { built, test, requireRole } = container({ ok: false, error: { code: 'TIMEOUT', message: 'm', hint: 'h' } }, { admin: false });

    await routes.handle(request(), response(), '/api/v1/native-cameras/test', 'POST', built);

    expect(requireRole).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'admin');
    expect(test).not.toHaveBeenCalled();
  });

  it('Scenario: Given a camera that answers When tested Then 200 with ok true, the picture and the details', async () => {
    const { built, test } = container({ ok: true, value: { snapshot: 'data:image/jpeg;base64,AAAA', width: 1920, height: 1080, codec: 'h264', ptzSupported: false } });
    const res = response();

    const handled = await routes.handle(request(), res, '/api/v1/native-cameras/test', 'POST', built);

    expect(handled).toBe(true);
    expect(test).toHaveBeenCalledWith(body);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(sent(res)).toEqual({ ok: true, snapshot: 'data:image/jpeg;base64,AAAA', width: 1920, height: 1080, codec: 'h264', ptzSupported: false });
  });

  it('Scenario: Given a camera that does not answer When tested Then it is a result, 200 with ok false, the code, the message and the hint', async () => {
    const { built } = container({ ok: false, error: { code: 'CREDENTIALS_REJECTED', message: 'La cámara rechazó el usuario o la contraseña.', hint: 'Revisa los datos.' } });
    const res = response();

    await routes.handle(request(), res, '/api/v1/native-cameras/test', 'POST', built);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(sent(res)).toEqual({ ok: false, code: 'CREDENTIALS_REJECTED', message: 'La cámara rechazó el usuario o la contraseña.', hint: 'Revisa los datos.' });
  });

  it('Scenario: Given bad input When tested Then it is a client error, 400', async () => {
    const { built } = container({ ok: false, error: { code: 'INVALID_INPUT', message: 'La dirección de la cámara no es válida.', hint: 'Revisa los datos.' } });
    const res = response();

    await routes.handle(request({ host: '169.254.169.254' }), res, '/api/v1/native-cameras/test', 'POST', built);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(sent(res)).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  });

  it('Scenario: Given a test When it runs Then no camera is created, updated or deleted', async () => {
    const { built } = container({ ok: true, value: { snapshot: 'data:image/jpeg;base64,AAAA', width: null, height: null, codec: null, ptzSupported: false } });

    await routes.handle(request(), response(), '/api/v1/native-cameras/test', 'POST', built);

    expect(nativeCameraService.create).not.toHaveBeenCalled();
    expect(nativeCameraService.update).not.toHaveBeenCalled();
    expect(nativeCameraService.delete).not.toHaveBeenCalled();
  });

  it('Scenario: Given an unexpected failure When tested Then 500 and no secret in the answer', async () => {
    const { built } = container(new Error('ffmpeg exploded'));
    const res = response();

    await routes.handle(request(), res, '/api/v1/native-cameras/test', 'POST', built);

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect((res.end as jest.Mock).mock.calls[0][0]).not.toContain('hunter2-secret');
  });

  it('Scenario: Given another path or method When it is sent Then the test route does not claim it', async () => {
    const { built } = container({ ok: true, value: { snapshot: 'x', width: null, height: null, codec: null, ptzSupported: false } });

    expect(await routes.handle(request(), response(), '/api/v1/native-cameras/other', 'POST', built)).toBe(false);
    expect(await routes.handle(request(), response(), '/api/v1/native-cameras/test', 'GET', built)).toBe(false);
  });
});
