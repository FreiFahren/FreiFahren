import { useState, useEffect } from 'react'

/**
 * A hook that returns true after a specified delay.
 * @param delayInMs The delay in milliseconds.
 * @returns True if the delay has passed, false otherwise.
 */
export const useTimeoutFlag = (delayInMs: number): boolean => {
    const [isTimeUp, setIsTimeUp] = useState(false)

    useEffect(() => {
        if (delayInMs <= 0) {
            setIsTimeUp(true)
            return
        }

        const timerId = setTimeout(() => {
            setIsTimeUp(true)
        }, delayInMs)

        return () => clearTimeout(timerId)
    }, [delayInMs])

    return isTimeUp
}
