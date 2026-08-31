import { EdgeRelayProtocolError, parseEdgeRelayRequest } from './EdgeRelayProtocol';

const identity = { homeId: 'home-a', edgeId: 'edge-a' };
const valid = { protocolVersion: 1, type: 'cloud.request', ...identity, requestId: 'request-a', operation: 'devices.read', principal: { accountId: 'account-a', role: 'member' }, expiresAt: '2030-01-01T00:01:00.000Z' };

describe('EdgeRelayProtocol', () => {
  it('accepts only the configured identity and allowlisted operation', () => {
    expect(parseEdgeRelayRequest(valid, identity, Date.parse('2030-01-01T00:00:00.000Z'))).toEqual(valid);
  });

  it.each([
    [{ ...valid, homeId: 'home-b' }, 'GATEWAY_IDENTITY_MISMATCH'],
    [{ ...valid, operation: 'camera.stream' }, 'GATEWAY_OPERATION_FORBIDDEN'],
    [{ ...valid, operation: 'device.command' }, 'GATEWAY_OPERATION_FORBIDDEN'],
    [{ ...valid, expiresAt: '2029-12-31T23:59:59.000Z' }, 'GATEWAY_REQUEST_EXPIRED'],
  ] as const)('rejects unsafe relay input', (message, code) => {
    expect(() => parseEdgeRelayRequest(message, identity, Date.parse('2030-01-01T00:00:00.000Z')))
      .toThrow(expect.objectContaining({ code }) as EdgeRelayProtocolError);
  });
});
