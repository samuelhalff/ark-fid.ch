/**
 * Next.js lint configuration set to "strict" so the CLI never prompts.
 * Builds on the framework defaults and keeps our custom rules focused on
 * TypeScript usage and React hooks.
 */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'next/typescript'],
  ignorePatterns: ['dist', '.next', 'node_modules'],
  env: {
    browser: true,
    es2020: true,
  },
  rules: {
    // Handled by the TS-specific rule below
    'no-unused-vars': 'off',
    // Let TypeScript catch undefined symbols instead of ESLint's heuristic
    'no-undef': 'off',
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
  ],
};
