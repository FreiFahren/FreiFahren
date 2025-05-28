import { useEffect, useState } from 'react'

export const useCountAnimation = (targetCount: number, duration: number): number => {
    const [currentCount, setCurrentCount] = useState(0)

    useEffect(() => {
        if (targetCount === 0) {
            setCurrentCount(0)
            return
        }

        const startTime = Date.now()
        const startCount = 0

        const updateCount = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4)
            const newCount = Math.round(startCount + (targetCount - startCount) * easeOutQuart)
            
            setCurrentCount(newCount)

            if (progress < 1) {
                requestAnimationFrame(updateCount)
            }
        }

        requestAnimationFrame(updateCount)
    }, [targetCount, duration])

    return currentCount
} 