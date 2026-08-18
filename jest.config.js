/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/', '<rootDir>/__tests__/', '<rootDir>/apps/'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  clearMocks: true,
  coverageProvider: 'v8',
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
