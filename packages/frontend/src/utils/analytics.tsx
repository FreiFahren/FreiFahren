import { AnalyticsOptions, SavedEvent } from './types'

/**
 * Saves an unsuccessful analytics event to local storage for later retry.
 *
 * @param {string} eventName - The name of the event to save.
 * @param {AnalyticsOptions} options - The parameters for the event.
 */
export const saveUnsuccessfulEvent = (eventName: string, options: AnalyticsOptions) => {
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
 */
export const sendAnalyticsEvent = (eventName: string, options?: AnalyticsOptions) => {
    (async () => {
        try {
            window.pirsch(eventName, options ?? {})
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to send event: ${eventName}`, error)
            saveUnsuccessfulEvent(eventName, options ?? {})
        }
    })().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(`Failed to send event: ${eventName}`, error)
    })
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

    for (const event of savedEvents) {
        try {
            // eslint-disable-next-line no-await-in-loop
            window.pirsch(event.eventName, event.options)
            // If successful, the event will not be added to remainingEvents
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to send saved event: ${event.eventName}`, error)
            // If the event is less than 24 hours old, keep it for retry
            if (Date.now() - event.timestamp < 24 * 60 * 60 * 1000) {
                remainingEvents.push(event)
            }
        }
    }

    localStorage.setItem('unsentAnalyticsEvents', JSON.stringify(remainingEvents))
}
