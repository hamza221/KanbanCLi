import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'cli',
      environment: 'node',
      include: ['cli/src/**/*.{test,spec}.{js,ts}'],
      globals: true,
    },
  },
  {
    extends: './web/vite.config.js',
    test: {
      name: 'web',
      environment: 'happy-dom',
      include: ['web/src/**/*.{test,spec}.{js,ts}'],
      globals: true,
      setupFiles: ['web/src/test/setup.js'],
    },
  },
  {
    test: {
      name: 'server',
      environment: 'node',
      include: ['server/src/**/*.{test,spec}.{js,ts}'],
      globals: true,
    },
  },
]);
