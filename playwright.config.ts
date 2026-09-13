import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  retries: 1,
  workers: 1, // 串行：共享同一 dev server 与 localStorage 语义，避免并发抖动
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5187',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5187 --strictPort',
    url: 'http://localhost:5187/arggame/',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
