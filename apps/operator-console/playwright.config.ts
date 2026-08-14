import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // The responsive shell shares one Vite development server and route mocks;
  // serial execution within the spec keeps first-load assertions deterministic.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
