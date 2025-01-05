import { useState, useEffect } from 'react'

const ANALYTICS_OPT_OUT_KEY = 'analyticsOptOut'

export const useAnalyticsOptOut = (): [boolean, (optOut: boolean) => void] => {
    const [isOptedOut, setIsOptedOut] = useState<boolean>(() => {
        const savedPreference = localStorage.getItem(ANALYTICS_OPT_OUT_KEY)
        return savedPreference ? JSON.parse(savedPreference) : false
    })

    // Note: this is do able without a useEffect
    useEffect(() => {
        localStorage.setItem(ANALYTICS_OPT_OUT_KEY, JSON.stringify(isOptedOut))
    }, [isOptedOut])

    return [isOptedOut, setIsOptedOut]
}

export const isAnalyticsOptedOut = (): boolean => {
    const savedPreference = localStorage.getItem(ANALYTICS_OPT_OUT_KEY)
    return savedPreference ? JSON.parse(savedPreference) : false
}
