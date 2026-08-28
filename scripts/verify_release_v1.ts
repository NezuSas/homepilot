interface ApiError {
  code?: unknown;
  message?: unknown;
}

interface ApiResponse {
  status: number;
  body: unknown;
}

const baseUrl = (process.env.HOMEPILOT_RELEASE_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
const username = process.env.HOMEPILOT_RELEASE_USERNAME;
const password = process.env.HOMEPILOT_RELEASE_PASSWORD;
const haBaseUrl = process.env.HOMEPILOT_RELEASE_HA_URL;
const haAccessToken = process.env.HOMEPILOT_RELEASE_HA_TOKEN;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getError(response: ApiResponse): ApiError | null {
  const body = asRecord(response.body);
  return body ? asRecord(body.error) : null;
}

async function request(path: string, options: RequestInit = {}): Promise<ApiResponse> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      body = rawBody;
    }
  }

  return { status: response.status, body };
}

interface ReleaseVerificationCredentials {
  username: string;
  password: string;
  haBaseUrl: string;
  haAccessToken: string;
}

function requireCredentials(): ReleaseVerificationCredentials {
  if (!username || !password || !haBaseUrl || !haAccessToken) {
    throw new Error('Set HOMEPILOT_RELEASE_USERNAME, HOMEPILOT_RELEASE_PASSWORD, HOMEPILOT_RELEASE_HA_URL and HOMEPILOT_RELEASE_HA_TOKEN before running release verification.');
  }

  return { username, password, haBaseUrl, haAccessToken };
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertError(response: ApiResponse, status: number, code: string): void {
  const error = getError(response);
  assertCondition(response.status === status, `Expected HTTP ${status}, received ${response.status}.`);
  assertCondition(error?.code === code && typeof error.message === 'string', `Expected public error ${code}.`);
}

async function login(credentials: ReleaseVerificationCredentials): Promise<string> {
  const response = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: credentials.username, password: credentials.password }),
  });
  const body = asRecord(response.body);
  const token = body?.token;

  assertCondition(response.status === 200 && typeof token === 'string' && token.length > 0, 'Login did not return an opaque session token.');
  return token;
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function run(): Promise<void> {
  const credentials = requireCredentials();
  console.log('Starting HomePilot Release V1 verification.');

  const unauthenticatedSetup = await request('/system/setup-status');
  assertError(unauthenticatedSetup, 401, 'UNAUTHORIZED');
  console.log('PASS setup-status authentication boundary');

  const token = await login(credentials);
  const notFound = await request('/invalid/route', { headers: bearer(token) });
  assertError(notFound, 404, 'NOT_FOUND');
  console.log('PASS authenticated not-found contract');

  const identity = await request('/auth/me', { headers: bearer(token) });
  const identityBody = asRecord(identity.body);
  assertCondition(identity.status === 200 && identityBody?.username === credentials.username, 'Authenticated identity does not match the login user.');
  assertCondition(!JSON.stringify(identity.body).includes('passwordHash'), 'Identity response exposed passwordHash.');
  console.log('PASS authentication and sanitized identity');

  const setupStatus = await request('/system/setup-status', { headers: bearer(token) });
  assertCondition(setupStatus.status === 200 && asRecord(setupStatus.body) !== null, 'Authenticated setup status is unavailable.');

  const diagnostics = await request('/system/diagnostics', { headers: bearer(token) });
  assertCondition(diagnostics.status === 200 && asRecord(diagnostics.body) !== null, 'Diagnostics snapshot is unavailable.');
  assertCondition(!JSON.stringify(diagnostics.body).includes('accessToken'), 'Diagnostics response exposed Home Assistant credentials.');
  console.log('PASS setup and diagnostics visibility');

  const homeAssistantStatus = await request('/settings/home-assistant', { headers: bearer(token) });
  assertCondition(homeAssistantStatus.status === 200 && asRecord(homeAssistantStatus.body) !== null, 'Home Assistant settings status is unavailable.');
  assertCondition(!JSON.stringify(homeAssistantStatus.body).includes('accessToken'), 'Home Assistant status exposed an access token.');

  const homeAssistantTest = await request('/settings/test-ha-connection', {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify({ baseUrl: credentials.haBaseUrl, accessToken: credentials.haAccessToken }),
  });
  const testBody = asRecord(homeAssistantTest.body);
  assertCondition(homeAssistantTest.status === 200 && testBody?.success === true, 'Home Assistant live connectivity test failed.');
  console.log('PASS Home Assistant live connectivity');

  const users = await request('/admin/users', { headers: bearer(token) });
  assertCondition(users.status === 200 && Array.isArray(users.body), 'Administrative user directory is unavailable.');
  assertCondition(!JSON.stringify(users.body).includes('passwordHash'), 'User directory exposed passwordHash.');
  console.log('PASS administrative directory sanitization');

  const logout = await request('/auth/logout', { method: 'POST', headers: bearer(token) });
  assertCondition(logout.status === 200, 'Logout failed.');
  const revokedIdentity = await request('/auth/me', { headers: bearer(token) });
  assertError(revokedIdentity, 401, 'UNAUTHORIZED');
  console.log('PASS session revocation');

  console.log('Release V1 verification completed successfully.');
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown release verification failure.';
  console.error(`Release V1 verification failed: ${message}`);
  process.exitCode = 1;
});