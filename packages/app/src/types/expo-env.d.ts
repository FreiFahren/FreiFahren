declare global {
    namespace NodeJS {
        interface ProcessEnv {
            EXPO_PUBLIC_FF_API_BASE_URL: string | undefined
            EXPO_PUBLIC_MAP_STYLE_URL: string | undefined
        }
    }
}

export {}
