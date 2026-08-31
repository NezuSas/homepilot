import { isGatewayOperationAllowed } from './CloudGatewayAuthorizationPolicy';

export const EDGE_RELAY_PROTOCOL_VERSION = 1;

export const allowedEdgeRelayOperations = [
  'dashboard.read',
  'devices.read',
  'device.command',
] as const;

export type EdgeRelayOperation = typeof allowedEdgeRelayOperations[number];

export interface EdgeRelayPrincipal { accountId: string; role: 'owner' | 'member'; }

export interface EdgeRelayRequest {
  protocolVersion: number;
  type: 'cloud.request';
  homeId: string;
  edgeId: string;
  requestId: string;
  operation: EdgeRelayOperation;
  principal: EdgeRelayPrincipal;
  input?: unknown;
  expiresAt: string;
}

export class EdgeRelayProtocolError extends Error {
  constructor(public readonly code: 'GATEWAY_MESSAGE_INVALID' | 'GATEWAY_IDENTITY_MISMATCH' | 'GATEWAY_REQUEST_EXPIRED' | 'GATEWAY_OPERATION_FORBIDDEN') {
    super(code);
  }
}

export function parseEdgeRelayRequest(raw: unknown, identity: { homeId: string; edgeId: string }, now = Date.now()): EdgeRelayRequest {
  if (!raw || typeof raw !== 'object') throw new EdgeRelayProtocolError('GATEWAY_MESSAGE_INVALID');
  const value = raw as Record<string, unknown>;
  if (value.protocolVersion !== EDGE_RELAY_PROTOCOL_VERSION || value.type !== 'cloud.request' || typeof value.requestId !== 'string' || !value.requestId) {
    throw new EdgeRelayProtocolError('GATEWAY_MESSAGE_INVALID');
  }
  if (value.homeId !== identity.homeId || value.edgeId !== identity.edgeId) throw new EdgeRelayProtocolError('GATEWAY_IDENTITY_MISMATCH');
  if (typeof value.expiresAt !== 'string' || Date.parse(value.expiresAt) <= now) throw new EdgeRelayProtocolError('GATEWAY_REQUEST_EXPIRED');
  if (!allowedEdgeRelayOperations.includes(value.operation as EdgeRelayOperation)) throw new EdgeRelayProtocolError('GATEWAY_OPERATION_FORBIDDEN');
  if (!isPrincipal(value.principal)) throw new EdgeRelayProtocolError('GATEWAY_MESSAGE_INVALID');
  if (!isGatewayOperationAllowed(value.principal.role, value.operation as EdgeRelayOperation)) throw new EdgeRelayProtocolError('GATEWAY_OPERATION_FORBIDDEN');
  return {
    protocolVersion: EDGE_RELAY_PROTOCOL_VERSION,
    type: 'cloud.request',
    homeId: identity.homeId,
    edgeId: identity.edgeId,
    requestId: value.requestId as string,
    operation: value.operation as EdgeRelayOperation,
    principal: value.principal,
    input: value.input,
    expiresAt: value.expiresAt as string,
  };
}

function isPrincipal(value: unknown): value is EdgeRelayPrincipal { return Boolean(value && typeof value === 'object' && typeof (value as Record<string, unknown>).accountId === 'string' && ((value as Record<string, unknown>).role === 'owner' || (value as Record<string, unknown>).role === 'member')); }
