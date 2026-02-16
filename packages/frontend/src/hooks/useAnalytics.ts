import { useEffect, useRef } from 'react'

import { AnalyticsOptions, SavedEvent } from '../utils/types'
import { isAnalyticsOptedOut } from './useAnalyticsOptOut'

/**
 * Checks if the Umami analytics SDK is loaded and available.
 * @returns {boolean} True if Umami is loaded, false otherwise.
 */
const isUmamiLoaded = (): boolean => typeof window.umami !== 'undefined'

/**
 * Waits for Umami to load with a timeout.
 * @param {number} timeout - Maximum time to wait in milliseconds.
 * @returns {Promise<void>} Resolves when Umami is loaded, rejects on timeout.
 */
const waitForUmami = (timeout = 2000): Promise<void> =>
    new Promise((resolve, reject) => {
        if (isUmamiLoaded()) {
            resolve()
            return
        }

        const startTime = Date.now()
        const interval = setInterval(() => {
            if (isUmamiLoaded()) {
                clearInterval(interval)
                resolve()
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval)
                reject(new Error('Umami SDK not loaded'))
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

export const sendAnalyticsEvent = async (eventName: string, options?: AnalyticsOptions): Promise<void> => {
    if (isAnalyticsOptedOut()) {
        return Promise.resolve()
    }

    try {
        await waitForUmami()
        return await new Promise((resolve, reject) => {
            try {
                if (window.umami) {
                    if (options?.meta && Object.keys(options.meta).length > 0){
                        window.umami.track(eventName, options.meta)
                    } else {
                        window.umami.track(eventName)
                    }
                }
                resolve()
            } catch (error) {
                console.error(`Failed to send event: ${eventName}`, error)
                saveUnsuccessfulEvent(eventName, options ?? {})
                reject(error)
            }
        })
    } catch (error) {
        console.warn('Umami SDK not loaded')
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

/**
 * Hook to track component views. This automatically sends an analytics event
 * when a component mounts, without requiring a useEffect in the component itself.
 *
 * @param {string} componentName - The name of the component to track
 * @param {AnalyticsOptions} [options] - Optional parameters for the event
 */
export const useTrackComponentView = (componentName: string, options?: AnalyticsOptions): void => {
    const isFirstRender = useRef(true)

    useEffect(() => {
        if (isFirstRender.current) {
            sendAnalyticsEvent(`${componentName} opened`, options)
            isFirstRender.current = false
        }
    }, [componentName, options])
}

export { isUmamiLoaded, waitForUmami }
