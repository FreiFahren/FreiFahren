import { AnalyticsOptions, SavedEvent } from './types'

/**
 * Sends an analytics event to the Pirsch SDK.
 * If the SDK is not loaded or an error occurs, the event is saved locally for later retry.
 *
 * @param {string} eventName - The name of the event to send.
 * @param {AnalyticsOptions} [options] - Optional parameters for the event.
 * @returns {Promise<void>} A promise that resolves if the event is sent successfully, or rejects with an error.
 */
export function sendAnalyticsEvent(eventName: string, options?: AnalyticsOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.pirsch) {
            try {
                window.pirsch(eventName, options || {})
                resolve()
            } catch (error) {
                console.error(`Failed to send event: ${eventName}`, error)
                saveUnsuccessfulEvent(eventName, options || {})
                reject(error)
            }
        } else {
            console.warn('Pirsch SDK not loaded')
            saveUnsuccessfulEvent(eventName, options || {})
            reject(new Error('Pirsch SDK not loaded'))
        }
    })
}

/**
 * Saves an unsuccessful analytics event to local storage for later retry.
 *
 * @param {string} eventName - The name of the event to save.
 * @param {AnalyticsOptions} options - The parameters for the event.
 */
export function saveUnsuccessfulEvent(eventName: string, options: AnalyticsOptions): void {
    const savedEvents: SavedEvent[] = JSON.parse(localStorage.getItem('unsent_analytics_events') || '[]')
    savedEvents.push({
        eventName,
        options,
        timestamp: Date.now(),
    })
    localStorage.setItem('unsent_analytics_events', JSON.stringify(savedEvents))
}

/**
 * Attempts to resend all previously saved unsuccessful analytics events.
 * Events older than 24 hours are discarded.
 *
 * @returns {Promise<void>} A promise that resolves when all events have been processed.
 */
export async function sendSavedEvents(): Promise<void> {
    const savedEvents: SavedEvent[] = JSON.parse(localStorage.getItem('unsent_analytics_events') || '[]')
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

    localStorage.setItem('unsent_analytics_events', JSON.stringify(remainingEvents))
}
