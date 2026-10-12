import { getAppAccessControl } from './accessControl';
import { DEFAULT_INSTALLED_FEATURES, resolveVisibleView } from './installedFeatures';

describe('Feature: only the administrator sees system information, everyone else uses the home', () => {
  it.each(['parent', 'child', 'guest'])('Scenario: Given the %s role When access is evaluated Then the system area is closed', (role) => {
    expect(getAppAccessControl(role).canAccessSystem).toBe(false);
  });

  it('Scenario: Given the administrator When access is evaluated Then the system area is open', () => {
    expect(getAppAccessControl('admin')).toMatchObject({ canAccessSystem: true, canAccessAdminControl: true, canAccessFamilyControl: true });
  });

  it('Scenario: Given an unknown or missing role When access is evaluated Then nothing is open', () => {
    expect(getAppAccessControl(undefined)).toEqual({
      canAccessBasicHomeViews: false,
      canAccessFamilyControl: false,
      canAccessAdminControl: false,
      canAccessDashboards: false,
      canAccessSystem: false,
    });
  });

  it('Scenario: Given the family roles When they use the home Then dashboards and controls stay available', () => {
    expect(getAppAccessControl('child')).toMatchObject({ canAccessBasicHomeViews: true, canAccessFamilyControl: true, canAccessDashboards: true });
    expect(getAppAccessControl('guest')).toMatchObject({ canAccessBasicHomeViews: true, canAccessFamilyControl: false, canAccessDashboards: true });
  });

  it('Scenario: Given a role without system access When it opens the assistant insights or a system view Then it lands on the dashboard', () => {
    expect(resolveVisibleView('assistant', DEFAULT_INSTALLED_FEATURES, false)).toBe('dashboard');
    expect(resolveVisibleView('system-executions', DEFAULT_INSTALLED_FEATURES, false)).toBe('dashboard');
    expect(resolveVisibleView('assistant', DEFAULT_INSTALLED_FEATURES, true)).toBe('assistant');
    expect(resolveVisibleView('home-conversation', DEFAULT_INSTALLED_FEATURES, false)).toBe('home-conversation');
  });
});
