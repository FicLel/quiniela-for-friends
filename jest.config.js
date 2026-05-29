/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Match the @/* path alias defined in tsconfig.json
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Use node module resolution for tests (simpler, avoids bundler-only features)
          moduleResolution: 'node',
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // Exclude node_modules, Next.js build artefacts, and agent worktrees
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/.claude/worktrees/'],
  // Extends Jest matchers with @testing-library/jest-dom after env setup
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

module.exports = config
