import { useEffect } from 'react';
import { useAppShellStore } from '../stores/useAppShellStore';
import { getScheduledTheme, nextThemeBoundaryDelay } from './automaticTheme';

export function useAutomaticTheme() {
  const automatic = useAppShellStore(state => state.automaticTheme);
  const setTheme = useAppShellStore(state => state.setTheme);
  useEffect(() => {
    if (!automatic) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setTheme(getScheduledTheme(now));
      timer = setTimeout(update, nextThemeBoundaryDelay(now));
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [automatic, setTheme]);
}
