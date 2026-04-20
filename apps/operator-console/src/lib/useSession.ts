/**
 * useSession.ts
 *
 * Custom hook que encapsula todo el estado y la lógica de sesión de usuario.
 *
 * Responsabilidades:
 *  - Leer el token inicial desde localStorage.
 *  - Exponer `handleLoginSuccess`, `handleLogout`, `clearSession`.
 *  - Ser agnóstico del router/UI — devuelve estado y callbacks puros.
 */

import { useState, useCallback } from 'react';

interface UserContext {
  username: string;
  role: string;
}

interface SessionState {
  isAuthenticated: boolean;
  user: UserContext | null;
}

interface UseSessionReturn extends SessionState {
  handleLoginSuccess: (token: string, user: UserContext) => void;
  handleLogout: (callApi?: () => Promise<void>) => Promise<void>;
  clearSession: () => void;
}

function readUserCtx(): UserContext | null {
  try {
    const raw = localStorage.getItem('hp_user_ctx');
    return raw ? (JSON.parse(raw) as UserContext) : null;
  } catch {
    return null;
  }
}

export function useSession(
  onSessionCleared: () => void
): UseSessionReturn {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('hp_session_token')
  );
  const [user, setUser] = useState<UserContext | null>(() => readUserCtx());

  const clearSession = useCallback(() => {
    localStorage.removeItem('hp_session_token');
    localStorage.removeItem('hp_user_ctx');
    setIsAuthenticated(false);
    setUser(null);
    onSessionCleared();
  }, [onSessionCleared]);

  const handleLoginSuccess = useCallback((token: string, ctx: UserContext) => {
    localStorage.setItem('hp_session_token', token);
    localStorage.setItem('hp_user_ctx', JSON.stringify(ctx));
    setIsAuthenticated(true);
    setUser(ctx);
  }, []);

  const handleLogout = useCallback(
    async (callApi?: () => Promise<void>) => {
      try {
        await callApi?.();
      } catch {
        // Ignore API errors during logout; local cleanup proceeds regardless.
      } finally {
        clearSession();
      }
    },
    [clearSession]
  );

  return { isAuthenticated, user, handleLoginSuccess, handleLogout, clearSession };
}
