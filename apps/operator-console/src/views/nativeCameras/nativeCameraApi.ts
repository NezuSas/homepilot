import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { NativeCameraFormData, NativeCameraPayload } from './types';

export interface CameraTestSuccess {
  ok: true;
  snapshot: string;
  width: number | null;
  height: number | null;
  codec: string | null;
  ptzSupported: boolean;
}

export interface CameraTestFailure {
  ok: false;
  code: string;
  message: string | null;
  hint: string | null;
}

export type CameraTestOutcome = CameraTestSuccess | CameraTestFailure;

export type SaveOutcome = { ok: true } | { ok: false; message: string | null };

const REQUEST_FAILED: CameraTestFailure = { ok: false, code: 'REQUEST_FAILED', message: null, hint: null };

function isTestOutcome(value: unknown): value is CameraTestOutcome {
  return typeof value === 'object' && value !== null && typeof (value as { ok?: unknown }).ok === 'boolean';
}

/** Asks the Edge to open the camera and return one frame; nothing is saved. */
export async function testNativeCamera(form: NativeCameraFormData, signal: AbortSignal): Promise<CameraTestOutcome> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras/test`, {
      method: 'POST',
      signal,
      body: JSON.stringify({
        sourceType: form.sourceType,
        host: form.host.trim(),
        username: form.username,
        password: form.password,
        rtspPort: Number(form.rtspPort),
        onvifPort: Number(form.onvifPort),
        rtspPath: form.rtspPath,
      }),
    });
    const body: unknown = await res.json().catch(() => null);
    return isTestOutcome(body) ? body : REQUEST_FAILED;
  } catch {
    return REQUEST_FAILED;
  }
}

/** Creates a camera and reports the reason the server gave when it refuses. */
export async function createNativeCamera(payload: NativeCameraPayload): Promise<SaveOutcome> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras`, { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: body?.error?.message || body?.message || null };
  } catch (err) {
    console.error(err);
    return { ok: false, message: null };
  }
}
