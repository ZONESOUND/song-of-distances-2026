import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {react, 'react-hooks': reactHooks},
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: {...globals.browser, ...globals.es2021},
    },
    settings: {react: {version: 'detect'}},
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
      // The 2019/2020 exhibition sources intentionally stay byte-identical on
      // this branch; these rules only flag that legacy content, so keep them
      // advisory instead of rewriting the artwork's original files.
      'react/no-unescaped-entities': 'warn',
      'react/no-unknown-property': 'warn',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
      // Added by eslint-plugin-react-hooks v7. It flags the 2019/2020 modals
      // (NameModal, LocHintModal), which mirror a prop into state and sync it
      // in an effect. That costs one extra render pass but is correct, so it
      // stays advisory here rather than being rewritten during a dependency
      // upgrade. Revisit it with the React 18 migration, where the modals get
      // touched deliberately.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {...globals.browser, ...globals.node, vi: 'readonly',
        describe: 'readonly', it: 'readonly', expect: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly'},
    },
  },
];
