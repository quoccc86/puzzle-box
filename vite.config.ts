import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/puzzle-box/',
  test: {
    environment: 'jsdom',
  },
});
