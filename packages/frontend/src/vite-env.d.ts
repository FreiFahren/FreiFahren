/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_JAWG_ACCESS_TOKEN: string
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
