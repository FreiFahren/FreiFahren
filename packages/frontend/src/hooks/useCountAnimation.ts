import { useState } from 'react'

export const useCountAnimation = (end: number, duration: number = 1000) => {
    const [count, setCount] = useState(0)

    useState(() => {
        let startTimestamp: number | null = null
        let animationFrame: number

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp
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
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame)
            }
        }
    })

    return count
}
