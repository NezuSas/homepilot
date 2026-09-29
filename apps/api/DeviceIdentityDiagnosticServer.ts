import { createServer, type Server } from 'node:http';

/** Minimal fail-closed API surface for a bound installation without its TPM identity. */
export function createDeviceIdentityDiagnosticServer(): Server {
  return createServer((_request, response) => {
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify({ status: 'NOT_READY', code: 'DEVICE_IDENTITY_INVALID',
      message: 'HomePilot no está activado para este dispositivo. Contacta con NEZU.' }));
  });
}
