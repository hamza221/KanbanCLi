import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'boards/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Relax Vue formatting rules (handled by prettier/manual style)
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': ['warn', {
        html: { void: 'any', normal: 'any', component: 'always' },
      }],
      'vue/attribute-hyphenation': 'off',
      'vue/attributes-order': 'off',

      // General rules
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
    },
  },
  // CLI-specific overrides (Node.js environment)
  {
    files: ['cli/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off', // CLI needs console
    },
  },
  // Server-specific overrides (Node.js environment)
  {
    files: ['server/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off', // Server needs console for startup logs
    },
  },
  // Test file overrides
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
    },
  },
];
