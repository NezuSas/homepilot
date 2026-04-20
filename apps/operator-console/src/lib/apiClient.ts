/**
 * apiClient.ts
 *
 * Cliente HTTP autenticado centralizado para HomePilot Edge.
 *
 * Responsabilidades:
 *  1. Inyectar el token Bearer en todas las peticiones no-whitelisted.
 *  2. Interceptar respuestas 401 y ejecutar un callback de logout explícito.
 *  3. Exponer una función tipada `apiFetch` como sustituto de `fetch`.
 *
 * No se parchea `window.fetch`. El interceptor 401 se configura
 * de forma explícita mediante `configureApiClient()` al inicio de la app.
 */

const AUTH_WHITELISTED = ['/api/v1/auth/login', '/health'];

type UnauthorizedCallback = () => void;

let onUnauthorized: UnauthorizedCallback | null = null;

/**
 * Configura el callback global ejecutado cuando cualquier respuesta es 401.
 * Debe llamarse UNA SOLA VEZ desde el punto de montaje de la app (App.tsx).
 */
export function configureApiClient(callbacks: { onUnauthorized: UnauthorizedCallback }): void {
  onUnauthorized = callbacks.onUnauthorized;
}

/**
 * Obtiene el token de sesión del almacenamiento local.
 */
function getSessionToken(): string | null {
  return localStorage.getItem('hp_session_token');
}

/**
 * Determina si una URL está exenta de inyección de token.
 */
function isWhitelisted(url: string): boolean {
  return AUTH_WHITELISTED.some((path) => url.includes(path));
}

/**
 * Cliente HTTP autenticado. Sustituye a `fetch` en toda la aplicación.
 *
 * - Inyecta `Authorization: Bearer <token>` automáticamente.
 * - Dispara `onUnauthorized()` ante respuestas 401 (solo si se configuró).
 * - Preserva la semántica de `fetch` (retorna `Response`, no lanza en !ok).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;

  const whitelisted = isWhitelisted(urlStr);
  const headers = new Headers(init?.headers);

  if (!whitelisted) {
    const token = getSessionToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 && !whitelisted) {
    if (getSessionToken()) {
      // Invoca el callback de logout; el consumidor decide qué limpiar.
      onUnauthorized?.();
    }
  }

  return response;
}
