import { useState } from 'react'

const ANALYTICS_OPT_OUT_KEY = 'umami.disabled'

const getStoredPreference = (): boolean => {
    const savedPreference = localStorage.getItem(ANALYTICS_OPT_OUT_KEY)
    return savedPreference === '1'
}

export const useAnalyticsOptOut = (): [boolean, (optOut: boolean) => void] => {
    const [isOptedOut, setIsOptedOut] = useState<boolean>(getStoredPreference)

    const updateOptOut = (optOut: boolean): void => {
        if (optOut) {
            localStorage.setItem(ANALYTICS_OPT_OUT_KEY, '1')
        } else {
            localStorage.removeItem(ANALYTICS_OPT_OUT_KEY)
        }
        setIsOptedOut(optOut)
    }

    return [isOptedOut, updateOptOut]
}

export const isAnalyticsOptedOut = (): boolean => {
    const savedPreference = localStorage.getItem(ANALYTICS_OPT_OUT_KEY)
    return savedPreference === '1'
}
