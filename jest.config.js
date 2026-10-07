/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/', '<rootDir>/__tests__/', '<rootDir>/apps/'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts', '**/*.test.tsx'],
  clearMocks: true,
  coverageProvider: 'v8',

  /*
   * Jest owns coverage for backend, domain logic and non-visual frontend logic.
   *
   * React presentation components are behaviorally gated by the Playwright
   * responsive suite. Their Jest test files still execute normally; only
   * their .tsx implementation files are excluded from the global coverage
   * denominator.
   */
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>[\\\\/]apps[\\\\/]operator-console[\\\\/]src[\\\\/].*\\.tsx$',
  ],

  coverageThreshold: {
    global: {
      branches: 78,
      functions: 91,
      lines: 92,
      statements: 91,
    },
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: {
          ignoreCodes: [1343, 2339]
        }
      }
    ]
  }
};
