import { useCallback, useState } from 'react'

const LEGAL_DISCLAIMER_ACCEPTED_AT_KEY = 'legalDisclaimerAcceptedAt'
const COOLDOWN_IN_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Determines whether the legal disclaimer should be displayed and provides a function to accept it.
 *
 * @returns A tuple: [boolean indicating if the disclaimer should be shown, function to accept the disclaimer].
 */
export const useShouldShowLegalDisclaimer = (): [boolean, () => void] => {
    const [shouldShow, setShouldShow] = useState<boolean>(() => {
        const acceptedAt = localStorage.getItem(LEGAL_DISCLAIMER_ACCEPTED_AT_KEY)
        if (!acceptedAt) {
            return true
        }
        const lastAcceptedDate = new Date(acceptedAt).getTime()
        if (Number.isNaN(lastAcceptedDate)) {
            // Invalid date stored, treat as not accepted
            return true
        }
        return Date.now() - lastAcceptedDate > COOLDOWN_IN_MS
    })

    const acceptDisclaimer = useCallback(() => {
        localStorage.setItem(LEGAL_DISCLAIMER_ACCEPTED_AT_KEY, new Date().toISOString())
        setShouldShow(false)
    }, [])

    return [shouldShow, acceptDisclaimer]
}
