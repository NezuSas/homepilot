import * as crypto from 'crypto';

export interface OnvifCredentials {
  readonly username: string;
  readonly password: string;
}

/**
 * WS-Security UsernameToken digest: base64(sha1(nonce || created || password)).
 * Exposed as a pure function (fixed nonce/created bytes in) so it is
 * deterministically unit-testable without mocking `crypto`.
 */
export function buildPasswordDigest(nonce: Buffer, created: string, password: string): string {
  return crypto.createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created, 'utf8'), Buffer.from(password, 'utf8')]))
    .digest('base64');
}

function buildSecurityHeader(credentials: OnvifCredentials, nonce: Buffer, created: string): string {
  const digest = buildPasswordDigest(nonce, created, credentials.password);
  const nonceBase64 = nonce.toString('base64');
  return [
    '<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">',
    '  <UsernameToken>',
    `    <Username>${escapeXml(credentials.username)}</Username>`,
    `    <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password>`,
    `    <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceBase64}</Nonce>`,
    `    <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>`,
    '  </UsernameToken>',
    '</Security>',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEnvelope(credentials: OnvifCredentials, body: string): string {
  const nonce = crypto.randomBytes(16);
  const created = new Date().toISOString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">',
    '  <s:Header>',
    buildSecurityHeader(credentials, nonce, created),
    '  </s:Header>',
    '  <s:Body>',
    body,
    '  </s:Body>',
    '</s:Envelope>',
  ].join('\n');
}

export function buildGetCapabilitiesEnvelope(credentials: OnvifCredentials): string {
  return buildEnvelope(credentials, '<GetCapabilities xmlns="http://www.onvif.org/ver10/device/wsdl"><Category>All</Category></GetCapabilities>');
}

export function buildGetProfilesEnvelope(credentials: OnvifCredentials): string {
  return buildEnvelope(credentials, '<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>');
}

export function buildGetStreamUriEnvelope(credentials: OnvifCredentials, profileToken: string): string {
  return buildEnvelope(credentials, [
    '<GetStreamUri xmlns="http://www.onvif.org/ver10/media/wsdl">',
    '  <StreamSetup>',
    '    <Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream>',
    '    <Transport xmlns="http://www.onvif.org/ver10/schema"><Protocol>RTSP</Protocol></Transport>',
    '  </StreamSetup>',
    `  <ProfileToken>${escapeXml(profileToken)}</ProfileToken>`,
    '</GetStreamUri>',
  ].join('\n'));
}

export interface PtzVector {
  readonly pan?: number;
  readonly tilt?: number;
  readonly zoom?: number;
}

export function buildGetPtzConfigurationOptionsEnvelope(credentials: OnvifCredentials, configurationToken: string): string {
  return buildEnvelope(credentials, [
    '<GetConfigurationOptions xmlns="http://www.onvif.org/ver20/ptz/wsdl">',
    `  <ConfigurationToken>${escapeXml(configurationToken)}</ConfigurationToken>`,
    '</GetConfigurationOptions>',
  ].join('\n'));
}

export function buildContinuousMoveEnvelope(credentials: OnvifCredentials, profileToken: string, vector: PtzVector): string {
  const pan = vector.pan ?? 0;
  const tilt = vector.tilt ?? 0;
  const zoom = vector.zoom ?? 0;
  return buildEnvelope(credentials, [
    '<ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">',
    `  <ProfileToken>${escapeXml(profileToken)}</ProfileToken>`,
    '  <Velocity>',
    `    <PanTilt xmlns="http://www.onvif.org/ver10/schema" x="${pan}" y="${tilt}"/>`,
    `    <Zoom xmlns="http://www.onvif.org/ver10/schema" x="${zoom}"/>`,
    '  </Velocity>',
    '</ContinuousMove>',
  ].join('\n'));
}

export function buildPtzStopEnvelope(credentials: OnvifCredentials, profileToken: string): string {
  return buildEnvelope(credentials, [
    '<Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">',
    `  <ProfileToken>${escapeXml(profileToken)}</ProfileToken>`,
    '  <PanTilt>true</PanTilt>',
    '  <Zoom>true</Zoom>',
    '</Stop>',
  ].join('\n'));
}
