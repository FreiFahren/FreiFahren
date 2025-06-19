/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                background: '#232323',
            },
            screens: {
                'h-sm': { raw: '(min-height: 640px)' },
                'h-md': { raw: '(min-height: 768px)' },
                'h-lg': { raw: '(min-height: 900px)' },
                'h-xl': { raw: '(min-height: 1024px)' },
            },
            animation: {
                popup: 'popup 0.25s ease forwards',
                'slide-in': 'slide-in 0.25s ease-out forwards',
                'slide-out': 'slide-out 0.25s ease-in forwards',
            },
            keyframes: {
                popup: {
                    '0%': {
                        transform: 'translate(-50%, -50%) scale(0.5)',
                        opacity: '0',
                    },
                    '100%': {
                        transform: 'translate(-50%, -50%) scale(1)',
                        opacity: '1',
                    },
                },
                'slide-in': {
                    '0%': {
                        transform: 'translateX(-50%) translateY(100%)',
                        opacity: '0',
                    },
                    '100%': {
                        transform: 'translateX(-50%) translateY(0%)',
                        opacity: '1',
                    },
                },
                'slide-out': {
                    '0%': {
                        transform: 'translateX(-50%) translateY(0%)',
                        opacity: '1',
                    },
                    '100%': {
                        transform: 'translateX(-50%) translateY(100%)',
                        opacity: '0',
                    },
                },
            },
        },
    },
    plugins: [],
}
