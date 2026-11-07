import tseslint from 'typescript-eslint';

/**
 * Layering rules from MASTER-PLAN §3. Each zone exists because the alternative
 * has already failed once in this codebase's short history:
 *
 *  - shell → pages: the shell would have to know every surface; adding one
 *    becomes a shell change (this is how a rail grows a hard-coded list).
 *  - components → pages/shell/services/data: a primitive that knows what a run
 *    is cannot be reused (Chip once imported its Tone from data/selectors).
 *  - lib → anything: pure functions stay testable without jsdom only if they
 *    import nothing from the app.
 *
 * Cross-page imports are not expressible as a glob here (a page may import its
 * own children); scripts/gates.mjs checks them instead.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'design/**', 'scripts/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/shell/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/pages/**', '../pages/*', '../../pages/*'],
              message: 'shell/ must not depend on a surface. Pass content in through a layout prop.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/pages/**', '**/shell/**'],
              message: 'A primitive must not know a surface or the shell.',
            },
            {
              group: ['**/services/**', '**/data/**'],
              message: 'A primitive must not know a wire shape or the sample model. Move the type to lib/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../**', '../../**'],
              message: 'lib/ is pure: it must not import the application.',
            },
          ],
        },
      ],
    },
  },
);
