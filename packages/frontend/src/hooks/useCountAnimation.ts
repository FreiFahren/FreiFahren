import { useEffect, useState } from 'react'

export const useCountAnimation = (end: number, duration: number = 1000) => {
    const [count, setCount] = useState(0)

    useEffect(() => {
        let startTimestamp: number | null = null
        let animationFrame: number

        const step = (timestamp: number) => {
            if (startTimestamp === null) startTimestamp = timestamp
            const progress = Math.min((timestamp - startTimestamp) / duration, 1)

            setCount(Math.floor(progress * end))

            if (progress < 1) {
                animationFrame = window.requestAnimationFrame(step)
            } else {
                setCount(end)
            }
        }

        animationFrame = window.requestAnimationFrame(step)

        // Cleanup
        return () => {
            if (animationFrame !== 0 ) {
                window.cancelAnimationFrame(animationFrame)
            }
        }
    }, [end, duration])

    return count
}
