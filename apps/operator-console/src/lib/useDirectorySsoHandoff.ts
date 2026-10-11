import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { consumeBrowserDirectoryHandoff, type BrowserDirectoryHandoff } from './browserDirectoryHandoff';
import type { UserContext } from './useSession';

export interface DirectorySsoHandoffOptions {
  /** Called when the directory account is already linked and returns a session. */
  onLinkedSession: (token: string, user: UserContext) => void;
  /** Called after a linked session so the app can leave the login route. */
  onDone: () => void;
}

/** Consumes the browser directory (SSO) handoff once and exposes the pending link token. */
export function useDirectorySsoHandoff({ onLinkedSession, onDone }: DirectorySsoHandoffOptions) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const handoffRef = useRef<Promise<BrowserDirectoryHandoff | null> | null>(null);

  useEffect(() => {
    let active = true;
    handoffRef.current ??= consumeBrowserDirectoryHandoff(`${API_BASE_URL}/api/v1/auth/sso/directory/consume-browser`);
    void handoffRef.current
      .then((result) => {
        if (!result || !active) return;
        if (result.linked && result.token && result.user) {
          setLinkToken(null);
          onLinkedSession(result.token, result.user);
          onDone();
          return;
        }
        setLinkToken(result.token);
      })
      .catch(() => {
        if (active) setHasError(true);
      });
    return () => { active = false; };
  }, [onLinkedSession, onDone]);

  return { linkToken, hasError };
}
