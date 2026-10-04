import { useEffect, useRef, useState } from 'react';

/** Short-lived result feedback shared by dashboard action tiles and favorite routines. */
export function useMomentaryActionFeedback() {
  const [actionFeedback, setActionFeedback] = useState<{ id: string; status: 'success' | 'error'; message?: string } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const clearActionFeedback = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setActionFeedback(null);
  };

  const showActionFeedback = (id: string, status: 'success' | 'error', message?: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setActionFeedback({ id, status, ...(message ? { message } : {}) });
    timerRef.current = window.setTimeout(() => {
      setActionFeedback((current) => current?.id === id ? null : current);
      timerRef.current = null;
    }, status === 'success' ? 1800 : 4000);
  };

  return { actionFeedback, clearActionFeedback, showActionFeedback };
}
