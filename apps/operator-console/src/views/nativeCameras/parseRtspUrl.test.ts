import { parseRtspUrl } from './parseRtspUrl';

describe('Feature: pasting a camera address', () => {
  it('Scenario: Given a full address When parsed Then every field is split out and credentials leave the path', () => {
    expect(parseRtspUrl('rtsp://admin:secret@192.168.1.35:8554/Streaming/Channels/102')).toEqual({
      host: '192.168.1.35', rtspPort: 8554, rtspPath: '/Streaming/Channels/102', username: 'admin', password: 'secret',
    });
  });

  it('Scenario: Given no port When parsed Then it defaults to 554', () => {
    expect(parseRtspUrl('rtsp://admin:x@cam.local/stream1')).toMatchObject({ host: 'cam.local', rtspPort: 554 });
  });

  it('Scenario: Given a query string When parsed Then it stays in the path', () => {
    expect(parseRtspUrl('rtsp://admin:x@10.0.0.2/cam/realmonitor?channel=1&subtype=0')?.rtspPath).toBe('/cam/realmonitor?channel=1&subtype=0');
  });

  it('Scenario: Given encoded special characters in the credentials When parsed Then they are decoded', () => {
    expect(parseRtspUrl('rtsp://us%40er:p%40ss%2Fw%3Ard@10.0.0.2/s')).toMatchObject({ username: 'us@er', password: 'p@ss/w:rd' });
  });

  it('Scenario: Given an unencoded @ in the password When parsed Then the last @ separates the host', () => {
    expect(parseRtspUrl('rtsp://admin:p@ss@10.0.0.2/s')).toMatchObject({ host: '10.0.0.2', password: 'p@ss' });
  });

  it('Scenario: Given no credentials and no path When parsed Then those fields are empty', () => {
    expect(parseRtspUrl('rtsp://192.168.1.9')).toEqual({ host: '192.168.1.9', rtspPort: 554, rtspPath: '', username: '', password: '' });
  });

  it('Scenario: Given a malformed percent sequence in the password When parsed Then it is kept as typed', () => {
    expect(parseRtspUrl('rtsp://admin:100%@10.0.0.2/s')?.password).toBe('100%');
  });

  it.each([
    ['empty text', ''],
    ['an http address', 'http://192.168.1.9/stream'],
    ['a bare IP', '192.168.1.9'],
    ['a port out of range', 'rtsp://10.0.0.2:99999/s'],
    ['no host', 'rtsp://'],
  ])('Scenario: Given %s When parsed Then it is not accepted', (_name, text) => {
    expect(parseRtspUrl(text)).toBeNull();
  });
});
