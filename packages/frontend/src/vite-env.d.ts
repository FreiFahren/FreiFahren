/// <reference types="vite/client" />

declare namespace React.JSX {
    interface IntrinsicElements {
        'stripe-buy-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            'buy-button-id': string
            'publishable-key': string
        }
    }
}

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_STRIPE_BUY_BUTTON_ID: string
    readonly VITE_STRIPE_PUBLISHABLE_KEY: string
    readonly VITE_MAP_STYLE_URL?: string
    readonly VITE_MAP_CENTER_LNG: string
    readonly VITE_MAP_CENTER_LAT: string
    readonly VITE_MAP_BOUNDS_SW_LNG: string
    readonly VITE_MAP_BOUNDS_SW_LAT: string
    readonly VITE_MAP_BOUNDS_NE_LNG: string
    readonly VITE_MAP_BOUNDS_NE_LAT: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
