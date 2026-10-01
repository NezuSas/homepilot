import { useEffect, useState } from 'react';

/** Only the first data load may replace the view; refresh keeps visible content. */
export function useInitialLoading(pending: boolean) {
  const [presented, setPresented] = useState(false);
  useEffect(() => {
    if (!pending) setPresented(true);
  }, [pending]);
  return pending && !presented;
}
