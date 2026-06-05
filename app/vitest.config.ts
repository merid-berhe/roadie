import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: vitest@2 bundles its own vite@5, which
// type-clashes with the app's vite@6 plugins. Unit tests are pure TS and need no
// React/Tailwind plugins, so this config stays plugin-free.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
