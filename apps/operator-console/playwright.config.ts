import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // The responsive shell shares one Vite development server and route mocks;
  // serial execution within the spec keeps first-load assertions deterministic.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    // The first tests of a run pay for Vite compiling on demand, and the suite runs beside Docker and an IDE
    // on developer machines; a slow first paint is not a failure, a missing element still is.
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: process.env.HOMEPILOT_RESPONSIVE_SERVER_MANAGED ? undefined : {
    // Execute Vite directly. Running it through `npm run` leaves a child
    // process on Windows after Playwright finishes, which made the responsive
    // check appear to hang even once every assertion had completed.
    command: 'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
