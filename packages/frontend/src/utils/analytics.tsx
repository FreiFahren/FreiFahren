import { AnalyticsOptions, SavedEvent } from './types'

/**
 * Saves an unsuccessful analytics event to local storage for later retry.
 *
 * @param {string} eventName - The name of the event to save.
 * @param {AnalyticsOptions} options - The parameters for the event.
 */
export const saveUnsuccessfulEvent = (eventName: string, options: AnalyticsOptions): void => {
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
export const sendAnalyticsEvent = (eventName: string, options?: AnalyticsOptions): Promise<void> =>
    new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
        if (window.pirsch) {
            try {
                window.pirsch(eventName, options ?? {})
                resolve()
            } catch (error) {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error(`Failed to send event: ${eventName}`, error)
                saveUnsuccessfulEvent(eventName, options ?? {})
                reject(error)
            }
        } else {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.warn('Pirsch SDK not loaded')
            saveUnsuccessfulEvent(eventName, options ?? {})
            reject(new Error('Pirsch SDK not loaded'))
        }
    })



/**
 * Attempts to resend all previously saved unsuccessful analytics events.
 * Events older than 24 hours are discarded.
 *
 * @returns {Promise<void>} A promise that resolves when all events have been processed.
 */
export const sendSavedEvents = async (): Promise<void> => {
    const savedEvents: SavedEvent[] = JSON.parse(localStorage.getItem('unsentAnalyticsEvents') ?? '[]')
    const promises = savedEvents.map(async (event) => {
        try {
            await sendAnalyticsEvent(event.eventName, event.options)
            return null;
        } catch (error) {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error(`Failed to send saved event: ${event.eventName}`, error)
            return Date.now() - event.timestamp < 24 * 60 * 60 * 1000 ? event : null
        }
    });

    const results = await Promise.all(promises);
    const remainingEvents = results.filter((event): event is SavedEvent => event !== null);

    localStorage.setItem('unsentAnalyticsEvents', JSON.stringify(remainingEvents))
}
