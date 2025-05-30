import { useEffect, useState } from 'react'

const MARKETING_MODAL_LAST_SHOWN_KEY = 'marketingModalLastShown'
const COOLDOWN_IN_MS = 14 * 24 * 60 * 60 * 1000
const INITIAL_DELAY_IN_MS = 30 * 1000

/**
 * Updates the localStorage with the current timestamp for when the marketing modal was shown.
 */
const updateMarketingModalLastShown = (): void => {
    localStorage.setItem(MARKETING_MODAL_LAST_SHOWN_KEY, new Date().toISOString())
}

/**
 * Determines whether the marketing modal should be displayed and provides a function to dismiss it.
 *
 * @returns A tuple: [boolean indicating if the modal should be shown, function to dismiss the modal].
 */
export const useShouldShowMarketingModal = (): [boolean, () => void] => {
    const [hasThirtySecondsPassed, setHasThirtySecondsPassed] = useState(false)
    const [isDismissedThisSession, setIsDismissedThisSession] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setHasThirtySecondsPassed(true)
        }, INITIAL_DELAY_IN_MS) // show only when user is already interested in the app

        return () => clearTimeout(timer)
    }, [])

    const lastShownTimestamp = localStorage.getItem(MARKETING_MODAL_LAST_SHOWN_KEY)
    const now = Date.now()

    let wasShownMoreThanTwoWeeksAgo = true // Default to true if never shown
    if (lastShownTimestamp) {
        const lastShownDate = new Date(lastShownTimestamp).getTime()
        if (!Number.isNaN(lastShownDate)) {
            wasShownMoreThanTwoWeeksAgo = now - lastShownDate > COOLDOWN_IN_MS
        }
    }

    const isIphone = /iPhone/i.test(navigator.userAgent)

    // include import.meta.env.DEV to make it easier to test the modal
    const shouldShow =
        wasShownMoreThanTwoWeeksAgo &&
        hasThirtySecondsPassed &&
        !isDismissedThisSession &&
        (import.meta.env.DEV || isIphone)

    const dismissModal = () => {
        updateMarketingModalLastShown()
        setIsDismissedThisSession(true)
    }

    return [shouldShow, dismissModal]
}
