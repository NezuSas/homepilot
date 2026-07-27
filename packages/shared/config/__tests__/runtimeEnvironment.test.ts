import { isDiagnosticLoggingEnabled, isTestRuntime } from '../runtimeEnvironment';

describe('runtimeEnvironment', () => {
  it('recognizes explicit test environments', () => {
    expect(isTestRuntime({ NODE_ENV: 'test' })).toBe(true);
  });

  it('recognizes Jest workers even when NODE_ENV is not set', () => {
    expect(isTestRuntime({ JEST_WORKER_ID: '1' })).toBe(true);
  });

  it('keeps diagnostics enabled only for non-production, non-test runs', () => {
    expect(isDiagnosticLoggingEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isDiagnosticLoggingEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(isDiagnosticLoggingEnabled({ JEST_WORKER_ID: '1' })).toBe(false);
  });
});
