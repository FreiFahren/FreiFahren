import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler', {}]],
            },
        }),
    ],
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
    define: {
        global: 'globalThis',
    },
    resolve: {
        alias: {
            src: path.resolve(__dirname, './src'),
        },
    },
})
