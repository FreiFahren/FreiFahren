import { useState } from 'react'

export function highlightElement(id: string) {
    const element = document.getElementById(id)

    if (element !== null) {
        if (element) {
            element.classList.add('highlight')
            setTimeout(() => {
                element.classList.remove('highlight')
            }, 3000)
        }
    } else {
        const elementClass = document.getElementsByClassName(id)

        if (elementClass) {
            elementClass[0].classList.add('highlight')
            setTimeout(() => {
                elementClass[0].classList.remove('highlight')
            }, 3000)
        }
    }
}

export function createWarningSpan(elementId: string, message: string) {
    let warningSpan = document.getElementById('warning-span')
    if (!warningSpan) {
        warningSpan = document.createElement('span')
        warningSpan.id = 'warning-span'
        warningSpan.className = 'red-highlight'
        warningSpan.textContent = message
        document.getElementById(elementId)?.appendChild(warningSpan)
    }
}

export function useModalAnimation(timeout = 250) {
    const [isOpen, setIsOpen] = useState(false)
    const [isAnimatingOut, setIsAnimatingOut] = useState(false)

    const openModal = () => setIsOpen(true)

    const closeModal = () => {
        setIsAnimatingOut(true)
        setTimeout(() => {
            setIsOpen(false)
            setIsAnimatingOut(false)
        }, timeout)
    }

    return { isOpen, isAnimatingOut, openModal, closeModal }
}

export const currentColorTheme = () => {
    const colorTheme = localStorage.getItem('colorTheme')
    return colorTheme ? colorTheme : 'dark'
}

export function setColorThemeInLocalStorage() {
    const colorTheme = currentColorTheme()

    if (colorTheme === 'dark') {
        localStorage.setItem('colorTheme', 'light')
    } else {
        localStorage.setItem('colorTheme', 'dark')
    }
}

export const stationDistanceMessage = (stationDistance: number | null): JSX.Element | null => {
    if (!stationDistance || stationDistance === null || stationDistance < 1) return null
    return (
        <div>
            {stationDistance > 1 ? <strong>{stationDistance} Stationen </strong> : <strong>eine Station </strong>}
            von dir entfernt
        </div>
    )
}

/**
 * Generates a JSX Element displaying a human-readable message about elapsed time.
 *
 * @param {number} elapsedTimeInMinutes - The elapsed time in minutes.
 * @returns {JSX.Element} A span element containing the formatted time message.
 *
 * The function handles three cases:
 * 1. If the elapsed time is more than 60 minutes, it displays the time in hours.
 * 2. If the elapsed time is 1 minute or less, it displays "Jetzt".
 * 3. For any other duration, it displays the time in minutes.
 */
export const elapsedTimeMessage = (elapsedTimeInMinutes: number, isHistoric: boolean): JSX.Element => {
    if (isHistoric || (elapsedTimeInMinutes > 45 && elapsedTimeInMinutes < 60)) {
        return (
            <span>
                Vor mehr als <strong>45 Minuten</strong>
            </span>
        )
    }
    if (Math.floor(elapsedTimeInMinutes / 60) === 1) {
        return (
            <span>
                Vor einer <strong>Stunde</strong>
            </span>
        )
    }
    if (elapsedTimeInMinutes > 60) {
        return (
            <span>
                Vor <strong>{Math.floor(elapsedTimeInMinutes / 60)} Stunden</strong>
            </span>
        )
    }
    if (elapsedTimeInMinutes <= 1) {
        return (
            <span>
                <strong>Jetzt</strong>
            </span>
        )
    }
    return (
        <span>
            Vor <strong>{elapsedTimeInMinutes} Minuten</strong>
        </span>
    )
}
