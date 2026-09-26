import { apiFetch, getApiRequestScope } from './apiClient';

// Only the four read-only resources used by diagnostics and dashboard widgets
// share requests. This is deliberately not a global HTTP/polling policy.
const REQUEST_TIMEOUT_MS = 10_000;

type Subscriber = {
  signal: AbortSignal;
  resolve: (response: Response) => void;
  reject: (reason: unknown) => void;
  onAbort: () => void;
};

type InFlight = {
  controller: AbortController;
  subscribers: Set<Subscriber>;
  timeout: ReturnType<typeof setTimeout>;
};

const inFlight = new Map<string, InFlight>();

export function isCancelledRequest(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function fetchDiagnosticResource(url: string, signal: AbortSignal): Promise<Response> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));

  const scope = getApiRequestScope();
  const key = `${scope}\n${url}`;
  let entry = inFlight.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = {
      controller,
      subscribers: new Set(),
      timeout: setTimeout(() => {
        controller.abort();
        settle(undefined, new Error('REQUEST_TIMEOUT'));
      }, REQUEST_TIMEOUT_MS),
    };
    inFlight.set(key, entry);
    const request = entry;
    void apiFetch(url, { signal: controller.signal }).then(
      (response) => settle(response),
      (error: unknown) => settle(undefined, error),
    );

    function settle(response?: Response, error?: unknown) {
      if (request.subscribers.size === 0) return;
      clearTimeout(request.timeout);
      if (inFlight.get(key) === request) inFlight.delete(key);
      for (const subscriber of request.subscribers) {
        subscriber.signal.removeEventListener('abort', subscriber.onAbort);
        if (getApiRequestScope() !== scope) subscriber.reject(new DOMException('Session changed', 'AbortError'));
        else if (error) subscriber.reject(error);
        else if (response) subscriber.resolve(response.clone());
      }
      request.subscribers.clear();
    }
  }

  const request = entry;
  return new Promise<Response>((resolve, reject) => {
    const subscriber: Subscriber = {
      signal, resolve, reject,
      onAbort: () => {
        request.subscribers.delete(subscriber);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        if (request.subscribers.size === 0) {
          clearTimeout(request.timeout);
          if (inFlight.get(key) === request) inFlight.delete(key);
          request.controller.abort();
        }
      },
    };
    request.subscribers.add(subscriber);
    signal.addEventListener('abort', subscriber.onAbort, { once: true });
    if (signal.aborted) subscriber.onAbort();
  });
}

export function startSequentialPolling(
  load: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      await load(controller.signal);
    } catch {
      // A failed refresh still leaves the next scheduled attempt available.
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => { void tick(); }, intervalMs);
    }
  };
  void tick();
  return () => {
    controller.abort();
    if (timer) clearTimeout(timer);
  };
}
