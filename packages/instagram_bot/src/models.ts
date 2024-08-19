export interface Inspector {
    timestamp: string
    station: Station
    direction: Station
    line: string
    isHistoric: boolean
}

export interface Station {
    id: string
    name: string
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
}

export interface TokenResponse {
    access_token: string
}

export interface TokenData {
    accessToken: string
    expiresAt: number
}

export interface PageData {
    access_token: string
    instagram_business_account: {
        id: string
    }
    id: string
}
