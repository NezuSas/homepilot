import type { SetupStatus } from '../appShellTypes';

export type ReadinessStatus = 'success' | 'warning' | 'error';

export interface ReadinessItem {
  labelKey: string;
  valueKey: string;
  valueSuffix?: string;
  status: ReadinessStatus;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Reads `error.message` or a plain `error` string from an API payload. */
export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;

  const { error } = payload;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return typeof error === 'string' ? error : fallback;
}

export function getRuntimeLabelKey(runtimeTarget: SetupStatus['runtimeTarget'] | undefined): string {
  if (runtimeTarget === 'docker_desktop') return 'onboarding.step2.runtime_docker_desktop';
  if (runtimeTarget === 'linux_edge') return 'onboarding.step2.runtime_linux_edge';
  return 'onboarding.step2.runtime_unknown';
}

export function canTestHomeAssistantConnection(
  baseUrl: string,
  accessToken: string,
  busy: { testing: boolean; saving: boolean }
): boolean {
  return baseUrl.length > 0 && accessToken.length > 0 && !busy.testing && !busy.saving;
}

/** Builds the diagnostics rows for step one; Home Assistant rows are skipped for native-only installs. */
export function buildReadinessItems(
  status: SetupStatus | null,
  isAdmin: boolean,
  isNativeOnly: boolean,
  username: string | undefined
): ReadinessItem[] {
  const adminItem: ReadinessItem = {
    labelKey: 'onboarding.step1.admin',
    valueKey: isAdmin ? 'onboarding.step1.ok' : 'onboarding.step1.missing',
    valueSuffix: isAdmin ? ` (${username})` : undefined,
    status: isAdmin ? 'success' : 'error'
  };
  if (isNativeOnly) return [adminItem];

  return [
    adminItem,
    {
      labelKey: 'onboarding.step1.ha_config',
      valueKey: status?.hasHAConfig ? 'onboarding.step1.config_present' : 'onboarding.step1.config_missing',
      status: status?.hasHAConfig ? 'success' : 'warning'
    },
    {
      labelKey: 'onboarding.step1.connection',
      valueKey: status?.haConnectionValid ? 'onboarding.step1.valid' : 'onboarding.step1.unknown',
      status: status?.haConnectionValid ? 'success' : 'warning'
    }
  ];
}
