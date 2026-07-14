import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Integration tests share one database — parallel files would
    // interleave writes and flake. One file at a time keeps them honest.
    fileParallelism: false,
  },
});