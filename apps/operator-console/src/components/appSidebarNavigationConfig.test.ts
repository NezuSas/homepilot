import { primarySidebarNavigation, systemSidebarNavigation } from './appSidebarNavigationConfig';

describe('app sidebar navigation configuration', () => {
  it('places System Status inside System rather than primary navigation', () => {
    expect(primarySidebarNavigation.some(item => item.view === 'resilience-showcase')).toBe(false);
    expect(systemSidebarNavigation.some(item => item.view === 'resilience-showcase')).toBe(true);
  });
  it('keeps every configured view unique', () => {
    const views = [...primarySidebarNavigation, ...systemSidebarNavigation].map((item) => item.view);
    expect(new Set(views).size).toBe(views.length);
  });

  it('keeps privileged system users behind the admin role', () => {
    expect(systemSidebarNavigation.find((item) => item.view === 'system-users')?.requires).toBe('admin-role');
  });
});
