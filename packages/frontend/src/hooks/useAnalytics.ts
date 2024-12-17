import { AnalyticsOptions, SavedEvent } from '../utils/types'

/**
 * Sends an analytics event to the Pirsch SDK.
 * If the SDK is not loaded or an error occurs, the event is saved locally for later retry.
 *
 * @param {string} eventName - The name of the event to send.
 * @param {AnalyticsOptions} [options] - Optional parameters for the event. Metadata that you want to send with the event.
 * @returns {Promise<void>} A promise that resolves if the event is sent successfully, or rejects with an error.
 */
export async function sendAnalyticsEvent(eventName: string, options?: AnalyticsOptions): Promise<void> {
    try {
        await waitForPirsch()
        return new Promise((resolve, reject) => {
            try {
                window.pirsch(eventName, options || {})
                resolve()
            } catch (error) {
                console.error(`Failed to send event: ${eventName}`, error)
                saveUnsuccessfulEvent(eventName, options || {})
                reject(error)
            }
        })
    } catch (error) {
        console.warn('Pirsch SDK not loaded')
        saveUnsuccessfulEvent(eventName, options || {})
        throw error
    }
}

/**
 * Saves an unsuccessful analytics event to local storage for later retry.
 *
 * @param {string} eventName - The name of the event to save.
 * @param {AnalyticsOptions} options - The parameters for the event.
 */
export function saveUnsuccessfulEvent(eventName: string, options: AnalyticsOptions): void {
    const savedEvents: SavedEvent[] = JSON.parse(localStorage.getItem('unsentAnalyticsEvents') || '[]')
    savedEvents.push({
        eventName,
        options,
        timestamp: Date.now(),
    })
    localStorage.setItem('unsentAnalyticsEvents', JSON.stringify(savedEvents))
}

/**
 * Attempts to resend all previously saved unsuccessful analytics events.
 * Events older than 24 hours are discarded.
 *
 * @returns {Promise<void>} A promise that resolves when all events have been processed.
 */
export async function sendSavedEvents(): Promise<void> {
    const savedEvents: SavedEvent[] = JSON.parse(localStorage.getItem('unsentAnalyticsEvents') || '[]')
    const remainingEvents: SavedEvent[] = []

    for (const event of savedEvents) {
        try {
            await sendAnalyticsEvent(event.eventName, event.options)
            // If successful, the event will not be added to remainingEvents
        } catch (error) {
            console.error(`Failed to send saved event: ${event.eventName}`, error)
            // If the event is less than 24 hours old, keep it for retry
            if (Date.now() - event.timestamp < 24 * 60 * 60 * 1000) {
                remainingEvents.push(event)
            }
        }
    }

    localStorage.setItem('unsentAnalyticsEvents', JSON.stringify(remainingEvents))
}

export function isPirschLoaded(): boolean {
    return typeof window.pirsch !== 'undefined'
}

export function waitForPirsch(timeout = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (isPirschLoaded()) {
            resolve()
            return
        }

        const startTime = Date.now()
        const interval = setInterval(() => {
            if (isPirschLoaded()) {
                clearInterval(interval)
                resolve()
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval)
                reject(new Error('Pirsch failed to load'))
            }
        }, 100)
    })
}
