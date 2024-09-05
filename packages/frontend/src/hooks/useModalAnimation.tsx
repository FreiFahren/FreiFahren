import { useState } from 'react'

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
