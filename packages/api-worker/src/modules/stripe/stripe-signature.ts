const TOLERANCE_SECONDS = 300

type ParsedSignature = {
    timestamp: number
    signatures: string[]
}

const parseHeader = (header: string): ParsedSignature | null => {
    let timestamp: number | undefined
    const signatures: string[] = []

    for (const item of header.split(',')) {
        const [key, ...rest] = item.split('=')
        const value = rest.join('=')
        if (key === 't') {
            const parsed = Number(value)
            if (!Number.isFinite(parsed)) return null
            timestamp = parsed
        } else if (key === 'v1' && value.length > 0) {
            signatures.push(value)
        }
    }

    if (timestamp === undefined || signatures.length === 0) return null
    return { timestamp, signatures }
}

const hmacHex = async (secret: string, payload: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const bytes = new Uint8Array(signature)
    let hex = ''
    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, '0')
    }
    return hex
}

const timingSafeEqual = (a: string, b: string): boolean => {
    if (a.length !== b.length) return false
    let mismatch = 0
    for (let i = 0; i < a.length; i++) {
        mismatch += a.charCodeAt(i) === b.charCodeAt(i) ? 0 : 1
    }
    return mismatch === 0
}

export const verifyStripeSignature = async (
    payload: string,
    header: string | undefined,
    secret: string,
    nowMs = Date.now()
): Promise<boolean> => {
    if (header === undefined) return false
    const parsed = parseHeader(header)
    if (parsed === null) return false
    if (Math.abs(nowMs / 1000 - parsed.timestamp) > TOLERANCE_SECONDS) return false
    const expected = await hmacHex(secret, `${parsed.timestamp}.${payload}`)
    return parsed.signatures.some((signature) => timingSafeEqual(signature, expected))
}
