import path from 'path';
import { getDatabasePath } from '../getDatabasePath';
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
  it('emits diagnostics in a non-test runtime', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalWorkerId = process.env.JEST_WORKER_ID;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    delete process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'development';

    try {
      logRuntimeDiagnostic('log', 'development diagnostic');
      expect(logSpy).toHaveBeenCalledWith('development diagnostic');
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalWorkerId === undefined) delete process.env.JEST_WORKER_ID;
      else process.env.JEST_WORKER_ID = originalWorkerId;
      logSpy.mockRestore();
    }
  });
});

describe('getDatabasePath', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('uses an explicit absolute path or resolves a relative configured path', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production', HOMEPILOT_DB_PATH: 'data/custom.db' };
    expect(getDatabasePath()).toBe(path.resolve(process.cwd(), 'data/custom.db'));

    process.env.HOMEPILOT_DB_PATH = '/var/lib/homepilot.db';
    expect(getDatabasePath()).toBe('/var/lib/homepilot.db');
  });

  it('allows the documented development fallback but rejects implicit production storage', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    delete process.env.HOMEPILOT_DB_PATH;
    expect(getDatabasePath()).toBe(path.resolve(process.cwd(), 'homepilot.local.db'));

    process.env = { ...originalEnv, NODE_ENV: 'production' };
    delete process.env.HOMEPILOT_DB_PATH;
    expect(() => getDatabasePath()).toThrow('HOMEPILOT_DB_PATH is required');
  });
});