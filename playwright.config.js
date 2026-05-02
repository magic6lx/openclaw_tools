import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3001',
    launchOptions: {
      args: ['--disable-web-security']
    }
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
});
