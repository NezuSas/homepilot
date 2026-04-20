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
 * Diseño:
 *  - SIN acoplamiento a localStorage. El token se obtiene mediante `getToken()`,
 *    inyectado explícitamente en `configureApiClient()`.
 *  - SIN monkey-patching de `window.fetch`.
 *  - Configurable una sola vez al inicio. Seguro ante hot-module-replacement.
 */

const AUTH_WHITELISTED = ['/api/v1/auth/login', '/health'];

type TokenGetter = () => string | null;
type UnauthorizedCallback = () => void;

interface ApiClientConfig {
  /** Función para obtener el token de sesión actual. */
  getToken: TokenGetter;
  /** Callback invocado cuando se recibe una respuesta 401 no-whitelisted. */
  onUnauthorized: UnauthorizedCallback;
}

let config: ApiClientConfig | null = null;

/**
 * Configura el cliente API.
 * Debe llamarse UNA SOLA VEZ al inicio de la aplicación (o ante cambios de sesión).
 * Recibe un `getToken` lazy — se invoca en cada petición, siempre refleja el estado actual.
 */
export function configureApiClient(clientConfig: ApiClientConfig): void {
  config = clientConfig;
}

/**
 * Extrae la URL como string desde los tipos que acepta `fetch`.
 * Evita casts frágiles usando guards de tipo explícitos.
 */
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  // Request object — tiene .url garantizado por la interfaz
  return (input as Request).url;
}

/**
 * Determina si una URL está exenta de autenticación.
 */
function isWhitelisted(url: string): boolean {
  return AUTH_WHITELISTED.some((path) => url.includes(path));
}

/**
 * Cliente HTTP autenticado. Sustituye a `fetch` en toda la aplicación.
 *
 * - Inyecta `Authorization: Bearer <token>` si hay token y la URL no es whitelisted.
 * - Dispara `onUnauthorized()` ante respuestas 401 si el cliente fue configurado.
 * - Preserva semántica `fetch`: retorna `Response`, nunca lanza en !ok.
 *
 * @throws Solo si `fetch` en sí lanza (e.g. red caída, CORS).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = resolveUrl(input);
  const whitelisted = isWhitelisted(url);
  const headers = new Headers(init?.headers);

  if (!whitelisted && config) {
    const token = config.getToken();
    if (!token) {
      // Fail-closed: if we know it's protected and we have no token, 
      // trigger unauthorized logic immediately without hitting network.
      window.dispatchEvent(new CustomEvent('hp-session-unauthorized'));
      config.onUnauthorized();
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED_PREFLIGHT' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 && !whitelisted && config) {
    // Verificamos que realmente había un token — evita falsos positivos en requests públicos
    if (config.getToken()) {
      // Disparamos evento global para que React (useSession) se entere y limpie estado
      window.dispatchEvent(new CustomEvent('hp-session-unauthorized'));
      config.onUnauthorized();
    }
  }

  return response;
}
