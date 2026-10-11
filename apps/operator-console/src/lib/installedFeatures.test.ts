import { isGlobalWakeListenerEnabled } from '../components/appShellBoundaryHelpers';
import { DEFAULT_INSTALLED_FEATURES, resolveVisibleView } from './installedFeatures';

describe('Feature: opciones del instalador en la consola', () => {
  it('Scenario: Given una instalación con chat When se abre la conversación Then la vista se conserva', () => {
    expect(resolveVisibleView('home-conversation', DEFAULT_INSTALLED_FEATURES)).toBe('home-conversation');
  });

  it('Scenario: Given una instalación sin chat When se abre la conversación Then se muestra el tablero y el resto no cambia', () => {
    expect(resolveVisibleView('home-conversation', { homeChat: false })).toBe('dashboard');
    expect(resolveVisibleView('spaces', { homeChat: false })).toBe('spaces');
    expect(resolveVisibleView('assistant', { homeChat: false })).toBe('assistant');
  });

  it('Scenario: Given una instalación sin chat When se evalúa la escucha global Then la palabra de activación queda apagada', () => {
    expect(isGlobalWakeListenerEnabled(true, false, false, true)).toBe(true);
    expect(isGlobalWakeListenerEnabled(true, false, false, false)).toBe(false);
    expect(isGlobalWakeListenerEnabled(true, false, false)).toBe(true);
  });
});
