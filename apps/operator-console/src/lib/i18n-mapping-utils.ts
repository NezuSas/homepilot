import type { TFunction } from 'i18next';

/**
 * Centralized utility for mapping technical internal strings to localized user-facing labels.
 * This ensures consistency across different views and prevents logic duplication.
 */

/**
 * Maps technical diagnostics status codes to localized labels.
 */
export const mapDiagnosticsStatus = (status: string, t: TFunction): string => {
  const key = `diagnostics.status.${status.toLowerCase()}`;
  const translated = t(key);
  // If no translation exists, return the humanized version of the status (e.g. "auth_error" -> "Auth Error")
  if (translated === key) {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return translated;
};

/**
 * Maps internal activity/audit log types to friendly localized descriptions.
 */
export const mapActivityType = (type: string, t: TFunction): string => {
  const key = `audit_logs.types.${type}`;
  const translated = t(key);
  if (translated === key) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return translated;
};

/**
 * Maps system roles to localized names.
 */
export const mapUserRole = (role: string, t: TFunction): string => {
  const key = `common.roles.${role.toLowerCase()}`;
  const translated = t(key);
  if (translated === key) {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }
  return translated;
};

/**
 * Maps boolean values to localized text.
 */
export const mapBoolean = (val: boolean, t: TFunction): string => {
  return val ? t('common.true') : t('common.false');
};

/**
 * Maps device commands (e.g. "turn_on", "open") to localized strings.
 */
export const mapDeviceCommand = (command: string, t: TFunction): string => {
  const key = `common.actions.${command}`;
  const translated = t(key);
  if (translated === key) {
    return command.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return translated;
};
