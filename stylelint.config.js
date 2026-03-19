/** @type {import('stylelint').Config} */
export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-standard-vue',
  ],
  plugins: [
    'stylelint-use-logical',
  ],
  rules: {
    // Enforce logical properties for RTL/LTR support
    'csstools/use-logical': ['always', {
      except: [
        // Allow physical height/width on root-level elements (html, body, #app)
        // and allow overflow-x/overflow-y which have poor logical support
        'height',
        'width',
        'min-height',
        'max-height',
        'min-width',
        'max-width',
        'overflow-x',
        'overflow-y',
      ],
    }],
    // Relax rules that conflict with our codebase style
    'no-descending-specificity': null,
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'declaration-block-no-redundant-longhand-properties': null,
  },
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
};
