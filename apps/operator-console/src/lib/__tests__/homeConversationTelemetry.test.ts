/// <reference types="jest" />
import {
  HOME_CONVERSATION_TELEMETRY_EVENT,
  recordHomeConversationTelemetry,
} from '../homeConversationTelemetry';

describe('homeConversationTelemetry', () => {
  it('emits structured telemetry locally without writing metadata to the console', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const listener = jest.fn();
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalCustomEvent = Object.getOwnPropertyDescriptor(globalThis, 'CustomEvent');
    const dispatchEvent = jest.fn((event: Event) => {
      listener(event);
      return true;
    });

    class MockCustomEvent<T> extends Event {
      readonly detail: T;

      constructor(type: string, detail: T) {
        super(type);
        this.detail = detail;
      }
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent },
    });
    Object.defineProperty(globalThis, 'CustomEvent', {
      configurable: true,
      value: class extends MockCustomEvent<unknown> {
        constructor(type: string, init: CustomEventInit<unknown>) {
          super(type, init.detail);
        }
      },
    });

    try {
      recordHomeConversationTelemetry('global_wake_processed', {
        elapsedMs: 120,
        responseType: 'answer'
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0]).toMatchObject({
        type: HOME_CONVERSATION_TELEMETRY_EVENT,
        detail: {
          phase: 'global_wake_processed',
          elapsedMs: 120,
          responseType: 'answer',
        },
      });
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
      if (originalCustomEvent) {
        Object.defineProperty(globalThis, 'CustomEvent', originalCustomEvent);
      } else {
        Reflect.deleteProperty(globalThis, 'CustomEvent');
      }
      consoleSpy.mockRestore();
    }
  });
  it('is a no-op when rendered outside a browser environment', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    if (originalWindow) Reflect.deleteProperty(globalThis, 'window');

    try {
      expect(() => recordHomeConversationTelemetry('global_wake_failed', { reason: 'ssr' })).not.toThrow();
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    }
  });
});
