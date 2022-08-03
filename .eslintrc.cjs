module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true
    },
    extends: ['react-app', 'react-app/jest'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['tsconfig.json']
    },
    ignorePatterns: ['.eslintrc.cjs'],
    plugins: ['@typescript-eslint'],
    rules: {
        '@typescript-eslint/no-non-null-assertion': ['off']
    }
};
