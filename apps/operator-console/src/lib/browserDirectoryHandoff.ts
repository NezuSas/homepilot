import type { UserContext } from './useSession';

export interface BrowserDirectoryHandoff {
  linked: boolean;
  token: string;
  user?: UserContext;
}

/** A missing browser handoff is the normal startup case, never an error. */
export async function consumeBrowserDirectoryHandoff(url: string): Promise<BrowserDirectoryHandoff | null> {
  const response = await fetch(url, { method: 'POST' });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`DIRECTORY_SSO_${response.status}`);

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('DIRECTORY_SSO_INVALID_RESPONSE');
  const handoff = payload as Partial<BrowserDirectoryHandoff>;
  if (typeof handoff.token !== 'string' || !handoff.token || typeof handoff.linked !== 'boolean') {
    throw new Error('DIRECTORY_SSO_INVALID_RESPONSE');
  }
  if (handoff.linked && (!handoff.user || typeof handoff.user !== 'object')) {
    throw new Error('DIRECTORY_SSO_INVALID_RESPONSE');
  }
  return handoff as BrowserDirectoryHandoff;
}
