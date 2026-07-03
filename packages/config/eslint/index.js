// Salud 共通 ESLint 設定
// すべての apps/* と packages/* で extends して使用する
/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  rules: {
    // 未使用変数はエラー（型のみの場合は除外）
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // any の使用は警告（完全禁止にすると開発が辛いため）
    '@typescript-eslint/no-explicit-any': 'warn',
    // console.log は開発時のみ許可
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}
