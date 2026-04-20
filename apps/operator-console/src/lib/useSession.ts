/**
 * useSession.ts
 *
 * Custom hook que encapsula todo el estado y la lógica de sesión de usuario.
 *
 * Responsabilidades:
 *  - Distinguir entre presencia de token y sesión válida (checking, authenticated, unauthenticated).
 *  - Realizar validación obligatoria contra el backend al arranque.
 *  - Reaccionar a eventos globales de 401 para limpieza centralizada.
 */

import { useState, useCallback, useEffect } from 'react';
import { API_ENDPOINTS } from '../config';

export type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface UserContext {
  id: string;
  username: string;
  role: string;
}

interface SessionState {
  status: SessionStatus;
  user: UserContext | null;
}

interface UseSessionReturn extends SessionState {
  handleLoginSuccess: (token: string, user: UserContext) => void;
  handleLogout: (callApi?: () => Promise<void>) => Promise<void>;
  validateSession: () => Promise<void>;
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
  const [status, setStatus] = useState<SessionStatus>(() => 
    localStorage.getItem('hp_session_token') ? 'checking' : 'unauthenticated'
  );
  const [user, setUser] = useState<UserContext | null>(() => readUserCtx());

  const clearSession = useCallback(() => {
    localStorage.removeItem('hp_session_token');
    localStorage.removeItem('hp_user_ctx');
    setStatus('unauthenticated');
    setUser(null);
    onSessionCleared();
  }, [onSessionCleared]);

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem('hp_session_token');
    if (!token) {
      clearSession();
      return;
    }

    try {
      // Usamos el apiClient global configurado en el bootstrap
      // Si responde 401, el cliente disparará el evento global que escuchamos abajo
      const { apiFetch } = await import('./apiClient');
      const res = await apiFetch(API_ENDPOINTS.auth.me);

      if (res.ok) {
        const userData = await res.json() as UserContext;
        setUser(userData);
        setStatus('authenticated');
      } else {
        // El interceptor de apiClient se encargará del clearSession si es 401
        // Si es otro error (500), por seguridad fail-closed
        if (res.status !== 401) {
          clearSession();
        }
      }
    } catch {
      clearSession();
    }
  }, [clearSession]);

  const handleLoginSuccess = useCallback((token: string, ctx: UserContext) => {
    localStorage.setItem('hp_session_token', token);
    localStorage.setItem('hp_user_ctx', JSON.stringify(ctx));
    setUser(ctx);
    setStatus('authenticated');
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

  // Escuchar evento global de desautenticación emitido por apiClient
  useEffect(() => {
    const handler = () => {
      clearSession();
    };
    window.addEventListener('hp-session-unauthorized', handler);
    return () => window.removeEventListener('hp-session-unauthorized', handler);
  }, [clearSession]);

  return { 
    status, 
    user, 
    handleLoginSuccess, 
    handleLogout, 
    validateSession,
    clearSession,
    // Shim para compatibilidad con componentes que aún busquen isAuthenticated
    isAuthenticated: status === 'authenticated'
  } as any;
}
