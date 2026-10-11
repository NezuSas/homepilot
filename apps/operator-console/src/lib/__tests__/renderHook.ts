import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The renderer is only a test harness here; its one-line deprecation notice would repeat for every render.
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
  originalConsoleError(...args);
};

/** Minimal hook harness for the node test environment: no DOM, real React effects and state. */
export function renderHook<Props, Result>(hook: (props: Props) => Result, initialProps: Props) {
  const result = {} as { current: Result };
  const Probe = ({ hookProps }: { hookProps: Props }) => {
    result.current = hook(hookProps);
    return null;
  };
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(createElement(Probe, { hookProps: initialProps })); });
  return {
    result,
    rerender: (props: Props) => act(() => { renderer.update(createElement(Probe, { hookProps: props })); }),
    unmount: () => act(() => { renderer.unmount(); }),
  };
}

/** Lets pending promise chains (mocked fetches) settle inside act. */
export async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
}

/** Installs a tiny event-target window/document pair for hooks that listen to browser events. */
export function installFakeWindow() {
  const target = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    querySelector: jest.fn().mockReturnValue(null),
  });
  const fakeWindow = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
  };
  const globals = globalThis as Record<string, unknown>;
  const previous = { window: globals.window, document: globals.document };
  globals.window = fakeWindow;
  globals.document = doc;
  return {
    window: fakeWindow,
    document: doc,
    restore: () => { globals.window = previous.window; globals.document = previous.document; },
  };
}

export function makeLocalStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  (globalThis as Record<string, unknown>).localStorage = storage;
  return { storage, data };
}

export function jsonResponse(body: unknown, init: { status?: number; contentType?: string } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? init.contentType ?? 'application/json' : null) },
    json: async () => body,
  } as unknown as Response;
}
