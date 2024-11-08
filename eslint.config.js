import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  ignores: ['lib/**', 'dist/**'],
  extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      },
    ],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
});
