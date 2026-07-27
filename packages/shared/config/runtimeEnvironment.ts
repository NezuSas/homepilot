/**
 * Identifies test execution consistently across direct Node runs and Jest workers.
 */
export function isTestRuntime(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV === 'test' || Boolean(environment.JEST_WORKER_ID);
}

/**
 * Keeps performance diagnostics available during local development without polluting test output.
 */
export function isDiagnosticLoggingEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV !== 'production' && !isTestRuntime(environment);
}
