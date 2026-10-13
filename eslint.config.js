import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Simulačný engine musí zostať nezávislý od UI a renderera.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*'],
              message: 'Engine nesmie importovať React.',
            },
            { group: ['pixi.js', 'pixi.js/*'], message: 'Engine nesmie importovať PixiJS.' },
            { group: ['zustand', 'zustand/*'], message: 'Engine nesmie importovať Zustand.' },
            { group: ['dexie'], message: 'Engine nesmie importovať Dexie.' },
            {
              group: ['@/renderer/*', '@/components/*', '@/stores/*', '@/app/*', '@/persistence/*'],
              message: 'Engine nesmie závisieť od vyšších vrstiev.',
            },
          ],
        },
      ],
    },
  },
);
