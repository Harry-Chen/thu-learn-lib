import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    retry: 1,
    globalSetup: ['./test/globalSetup.ts'],
  },
});
