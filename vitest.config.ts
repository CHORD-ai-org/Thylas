import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic only for now: tabs, routes, selectors. Component tests add jsdom
    // when a component earns one (Testing Library is not installed yet).
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    reporters: 'default',
  },
});
