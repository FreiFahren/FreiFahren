import { AnalyticsOptions, SavedEvent } from '../utils/types'
import { isAnalyticsOptedOut } from './useAnalyticsOptOut'

/**
 * Checks if the Pirsch analytics SDK is loaded and available.
 * @returns {boolean} True if Pirsch is loaded, false otherwise.
 */
const isPirschLoaded = (): boolean => typeof window.pirsch !== 'undefined'

/**
 * Waits for Pirsch SDK to load with a timeout.
 * @param {number} timeout - Maximum time to wait in milliseconds.
 * @returns {Promise<void>} Resolves when Pirsch is loaded, rejects on timeout.
 */
const waitForPirsch = (timeout = 2000): Promise<void> =>
    new Promise((resolve, reject) => {
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

/**
 * Saves an unsuccessful analytics event to local storage for later retry.
 * @param {string} eventName - The name of the event to save.
 * @param {AnalyticsOptions} options - The parameters for the event.
 */
const saveUnsuccessfulEvent = (eventName: string, options: AnalyticsOptions): void => {
    const savedEvents: SavedEvent[] = JSON.parse(localStorage.getItem('unsentAnalyticsEvents') ?? '[]')
    savedEvents.push({
        eventName,
        options,
        timestamp: Date.now(),
    })
    localStorage.setItem('unsentAnalyticsEvents', JSON.stringify(savedEvents))
}

/**
 * Sends an analytics event to the Pirsch SDK.
 * If the SDK is not loaded or an error occurs, the event is saved locally for later retry.
 *
 * @param {string} eventName - The name of the event to send.
 * @param {AnalyticsOptions} [options] - Optional parameters for the event. Metadata that you want to send with the event.
 * @returns {Promise<void>} A promise that resolves if the event is sent successfully, or rejects with an error.
 */
export const sendAnalyticsEvent = async (eventName: string, options?: AnalyticsOptions): Promise<void> => {
    if (isAnalyticsOptedOut()) {
        return Promise.resolve()
    }

    try {
        await waitForPirsch()
        return await new Promise((resolve, reject) => {
            try {
                window.pirsch(eventName, options ?? {})
                resolve()
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Failed to send event: ${eventName}`, error)
                saveUnsuccessfulEvent(eventName, options ?? {})
                reject(error)
            }
        })
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Pirsch SDK not loaded')
        saveUnsuccessfulEvent(eventName, options ?? {})
        throw error
    }
}

/**
 * Attempts to resend all previously saved unsuccessful analytics events.
 * Events older than 24 hours are discarded.
 *
 * @returns {Promise<void>} A promise that resolves when all events have been processed.
 */
export const sendSavedEvents = async (): Promise<void> => {
    const savedEvents: SavedEvent[] = JSON.parse(localStorage.getItem('unsentAnalyticsEvents') ?? '[]')
    const remainingEvents: SavedEvent[] = []
    const currentTime = Date.now()

    const eventPromises = savedEvents.map(async (event) => {
        // Skip events older than 24 hours
        if (currentTime - event.timestamp >= 24 * 60 * 60 * 1000) {
            return
        }

        try {
            await sendAnalyticsEvent(event.eventName, event.options)
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to send saved event: ${event.eventName}`, error)
            remainingEvents.push(event)
        }
    })

    await Promise.all(eventPromises)
    localStorage.setItem('unsentAnalyticsEvents', JSON.stringify(remainingEvents))
}

export { isPirschLoaded, waitForPirsch }
