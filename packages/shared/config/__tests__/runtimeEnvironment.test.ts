import { isDiagnosticLoggingEnabled, isTestRuntime, logRuntimeDiagnostic } from '../runtimeEnvironment';

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

  it('does not emit runtime diagnostics in Jest', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      logRuntimeDiagnostic('error', 'expected test diagnostic');
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
