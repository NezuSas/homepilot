import { getAppSidebarShellClassName, getAppViewRouterLayout, getRoutineSection, isGlobalWakeListenerEnabled } from './appShellBoundaryHelpers';

describe('operator console shell boundaries', () => {
  it('keeps global wake disabled until an authenticated setup is complete', () => {
    expect(isGlobalWakeListenerEnabled(true, false, false)).toBe(true);
    expect(isGlobalWakeListenerEnabled(false, false, false)).toBe(false);
    expect(isGlobalWakeListenerEnabled(true, true, false)).toBe(false);
    expect(isGlobalWakeListenerEnabled(true, false, true)).toBe(false);
  });

  it('gives immersive views the correct page-frame contract', () => {
    expect(getAppViewRouterLayout('dashboards')).toEqual({ immersive: true, pageClassName: undefined });
    expect(getAppViewRouterLayout('home-conversation')).toEqual({ immersive: true, pageClassName: 'h-full' });
    expect(getAppViewRouterLayout('spaces')).toEqual({ immersive: false, pageClassName: undefined });
    expect(getRoutineSection('/routines/automations', true)).toBe('automations');
    expect(getRoutineSection('/routines/automations', false)).toBe('scenes');
  });

  it('preserves mobile drawer and desktop collapsed shell states', () => {
    expect(getAppSidebarShellClassName(false, true)).toContain('-translate-x-full');
    expect(getAppSidebarShellClassName(true, true)).toContain('shadow-sidebar-open');
    expect(getAppSidebarShellClassName(false, false)).toContain('xl:w-sidebar-collapsed');
    expect(getAppSidebarShellClassName(false, true)).toContain('xl:w-sidebar-expanded');
  });
});
