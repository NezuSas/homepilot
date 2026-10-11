import { isGlobalWakeListenerEnabled } from '../components/appShellBoundaryHelpers';
import { DEFAULT_INSTALLED_FEATURES, resolveVisibleView } from './installedFeatures';

describe('Feature: opciones del instalador en la consola', () => {
  it('Scenario: Given una instalación con chat When se abre la conversación Then la vista se conserva', () => {
    expect(resolveVisibleView('home-conversation', DEFAULT_INSTALLED_FEATURES)).toBe('home-conversation');
  });

  it('Scenario: Given una instalación sin chat When se abre la conversación Then se muestra el tablero y el resto no cambia', () => {
    expect(resolveVisibleView('home-conversation', { homeChat: false, voice: false })).toBe('dashboard');
    expect(resolveVisibleView('spaces', { homeChat: false, voice: false })).toBe('spaces');
    expect(resolveVisibleView('assistant', { homeChat: false, voice: false })).toBe('assistant');
  });

  it('Scenario: Given un rol sin acceso al sistema When abre una vista del sistema Then se muestra el tablero y el resto no cambia', () => {
    expect(resolveVisibleView('system-diagnostics', DEFAULT_INSTALLED_FEATURES, false)).toBe('dashboard');
    expect(resolveVisibleView('system-modbus', DEFAULT_INSTALLED_FEATURES, false)).toBe('dashboard');
    expect(resolveVisibleView('system-diagnostics', DEFAULT_INSTALLED_FEATURES, true)).toBe('system-diagnostics');
    expect(resolveVisibleView('system-diagnostics', DEFAULT_INSTALLED_FEATURES)).toBe('system-diagnostics');
    expect(resolveVisibleView('routines', DEFAULT_INSTALLED_FEATURES, false)).toBe('routines');
  });

  it('Scenario: Given una instalación sin chat When se evalúa la escucha global Then la palabra de activación queda apagada', () => {
    expect(isGlobalWakeListenerEnabled(true, false, false, true)).toBe(true);
    expect(isGlobalWakeListenerEnabled(true, false, false, false)).toBe(false);
    expect(isGlobalWakeListenerEnabled(true, false, false)).toBe(true);
  });
});
