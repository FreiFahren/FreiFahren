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

export interface PageData {
    access_token: string
}

export interface AccountsResponse {
    data: PageData[]
}

export interface InstagramAccountResponse {
    instagram_business_account: {
        id: string
    }
}
