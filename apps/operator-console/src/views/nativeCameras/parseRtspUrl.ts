export interface ParsedRtspUrl {
  host: string;
  rtspPort: number;
  rtspPath: string;
  username: string;
  password: string;
}

function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/**
 * Splits `rtsp://[user[:password]@]host[:port]/path` into the wizard fields, so the person can paste
 * the address the camera's manual gives them. Credentials never stay in the path. Returns null when
 * the text is not a usable RTSP address.
 */
export function parseRtspUrl(text: string): ParsedRtspUrl | null {
  const trimmed = text.trim();
  if (!/^rtsp:\/\//i.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!url.hostname) return null;
  return {
    host: url.hostname,
    rtspPort: url.port ? Number(url.port) : 554,
    rtspPath: `${url.pathname === '/' ? '' : url.pathname}${url.search}`,
    username: decode(url.username),
    password: decode(url.password),
  };
}
