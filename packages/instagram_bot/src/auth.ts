import { type TokenResponse, type TokenData, type PageData } from './models'

import fetch from 'node-fetch'
import fs from 'fs/promises'

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const PAGE_ID = process.env.PAGE_ID
const TOKEN_FILE = 'instagram_token.json'

async function saveTokenData(data: TokenData): Promise<void> {
    await fs.writeFile(TOKEN_FILE, JSON.stringify(data))
}

async function getTokenData(): Promise<TokenData | null> {
    try {
        const data = await fs.readFile(TOKEN_FILE, 'utf-8')
        return JSON.parse(data) as TokenData
    } catch (error) {
        return null
    }
}

async function refreshLongLivedToken(currentToken: string): Promise<TokenData> {
    const response = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&fb_exchange_token=${currentToken}`
    )
    const data = (await response.json()) as TokenResponse & {
        expires_in?: number
    }
    if (!data.access_token) {
        throw new Error('Failed to refresh long-lived token')
    }
    const expiresIn = data.expires_in || 60 * 24 * 60 * 60 // 60 days in seconds
    const expiresAt = Date.now() + expiresIn * 1000
    return { accessToken: data.access_token, expiresAt }
}

async function exchangeToken(shortLivedToken: string): Promise<TokenData> {
    const response = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`
    )
    const data = (await response.json()) as TokenResponse & {
        expires_in?: number
    }
    if (!data.access_token) {
        console.error('Token exchange failed:', data)
        throw new Error('Failed to exchange token')
    }
    console.log('Token exchanged successfully:', data)

    const expiresIn = 60 * 24 * 60 * 60 // 60 days in seconds
    const expiresAt = Date.now() + expiresIn * 1000

    return { accessToken: data.access_token, expiresAt }
}

export async function getValidAccessToken(): Promise<string> {
    let tokenData = await getTokenData()

    if (!tokenData) {
        // If no token exists, exchange the short-lived token for a long-lived one
        const shortLivedToken = process.env.SHORT_LIVED_ACCESS_TOKEN
        if (!shortLivedToken) {
            throw new Error('Missing SHORT_LIVED_ACCESS_TOKEN environment variable')
        }
        tokenData = await exchangeToken(shortLivedToken)
        await saveTokenData(tokenData)
    } else if (tokenData.expiresAt - Date.now() < 7 * 24 * 60 * 60 * 1000) {
        // If token expires in less than 7 days, refresh it
        console.log('Token expiring soon. Refreshing...')
        tokenData = await refreshLongLivedToken(tokenData.accessToken)
        await saveTokenData(tokenData)
    }

    return tokenData.accessToken
}

export async function getInstagramUserToken(
    accessToken: string
): Promise<{ pageAccessToken: string; instagramAccountId: string }> {
    const pageResponse = await fetch(
        `https://graph.facebook.com/v20.0/${PAGE_ID}?fields=access_token,instagram_business_account&access_token=${accessToken}`
    )
    if (!pageResponse.ok) {
        const errorData = await pageResponse.json()
        console.error('Error fetching page data:', errorData)
        throw new Error(`Failed to fetch page data: ${pageResponse.status} ${pageResponse.statusText}`)
    }

    const pageData = (await pageResponse.json()) as PageData
    console.log('Page Data:', pageData)

    if (!pageData.access_token) {
        console.error('Page access token not found in response:', pageData)
        throw new Error('Page access token not found')
    }

    if (!pageData.instagram_business_account || !pageData.instagram_business_account.id) {
        console.error('Instagram business account not found:', pageData)
        throw new Error('Instagram business account not found')
    }

    return {
        pageAccessToken: pageData.access_token,
        instagramAccountId: pageData.instagram_business_account.id,
    }
}
