export interface DiagnosticsCounters {
  recentReconnects: number;
  recentAutomationSuccess: number;
  recentAutomationFailures: number;
  recentReconciliations: number;
}

export interface SystemIssue {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
}

export interface DiagnosticsSnapshot {
  overallStatus: 'healthy' | 'degraded' | 'offline';
  haConnectionStatus: string;
  websocketStatus: string;
  automationEngineStatus: string;
  reconciliationStatus: string;
  lastEventAt: string | null;
  lastReconnectAt: string | null;
  lastReconciliationAt: string | null;
  lastAutomationExecutionAt: string | null;
  systemTime: string;
  systemTimeLocal: string;
  systemTimezone: string;
  counters: DiagnosticsCounters;
  issues: SystemIssue[];
}

export interface DiagnosticEvent {
  occurredAt: string;
  category: 'resilience' | 'automation' | 'auth' | 'command';
  eventType: string;
  description: string;
  data: Record<string, unknown>;
  correlationId?: string;
}

export interface DiagnosticScene {
  id?: string;
  actions?: { deviceId: string }[];
}

export interface DiagnosticAutomation {
  trigger?: {
    type?: string;
    deviceId?: string;
  };
  action?: {
    type?: string;
    targetDeviceId?: string;
    sceneId?: string;
  };
}

export const TIMEZONE_VALUES = [
  'America/Guayaquil',
  'America/Bogota',
  'America/Mexico_City',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Caracas',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC'
];

/** True when the persisted user context belongs to an administrator. */
export function isAdminUserContext(rawContext: string | null): boolean {
  const user: { role?: string } = JSON.parse(rawContext || '{}');
  return user.role === 'admin';
}
