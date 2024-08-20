import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
    plugins: {
        'react-hooks': reactHooksPlugin,
    },
    rules: {
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'react-hooks/exhaustive-deps': 'warn',
    },
})
