import { useState } from 'react'

const ANALYTICS_OPT_OUT_KEY = 'analyticsOptOut'

const getStoredPreference = (): boolean => {
    const savedPreference = localStorage.getItem(ANALYTICS_OPT_OUT_KEY)
    return savedPreference !== null && JSON.parse(savedPreference)
}

export const useAnalyticsOptOut = (): [boolean, (optOut: boolean) => void] => {
    const [isOptedOut, setIsOptedOut] = useState<boolean>(getStoredPreference)

    const updateOptOut = (optOut: boolean): void => {
        localStorage.setItem(ANALYTICS_OPT_OUT_KEY, JSON.stringify(optOut))
        setIsOptedOut(optOut)
    }

    return [isOptedOut, updateOptOut]
}

export const isAnalyticsOptedOut = (): boolean => {
    const savedPreference = localStorage.getItem(ANALYTICS_OPT_OUT_KEY)
    return savedPreference !== null && JSON.parse(savedPreference)
}
