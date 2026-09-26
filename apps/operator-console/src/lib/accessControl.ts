const BASIC_HOME_ROLES = new Set(['admin', 'operator', 'parent', 'child', 'guest']);
const FAMILY_CONTROL_ROLES = new Set(['admin', 'operator', 'parent', 'child']);
const ADMIN_CONTROL_ROLES = new Set(['admin', 'operator', 'parent']);
const SYSTEM_ROLES = new Set(['admin', 'operator']);

export interface AppAccessControl {
  canAccessBasicHomeViews: boolean;
  canAccessFamilyControl: boolean;
  canAccessAdminControl: boolean;
  canAccessDashboards: boolean;
  canAccessSystem: boolean;
}

export function getAppAccessControl(role?: string): AppAccessControl {
  const canAccessBasicHomeViews = Boolean(role && BASIC_HOME_ROLES.has(role));

  return {
    canAccessBasicHomeViews,
    canAccessFamilyControl: Boolean(role && FAMILY_CONTROL_ROLES.has(role)),
    canAccessAdminControl: Boolean(role && ADMIN_CONTROL_ROLES.has(role)),
    canAccessDashboards: canAccessBasicHomeViews,
    canAccessSystem: Boolean(role && SYSTEM_ROLES.has(role)),
  };
}
