import { useState } from 'react'

type ModalAnimation = {
    isOpen: boolean
    isAnimatingOut: boolean
    openModal: () => void
    closeModal: () => void
}

/**
 * A custom hook for managing modal animations.
 *
 * This hook provides state and functions to control the opening and closing
 * animations of a modal. It manages the visibility of the modal and handles
 * the timing of the closing animation.
 *
 * @param {number} timeout - The duration of the closing animation in milliseconds. Default is 250ms.
 * @returns {ModalAnimation} An object containing state and functions to control the modal.
 * @property {boolean} isOpen - Indicates whether the modal is currently open.
 * @property {boolean} isAnimatingOut - Indicates whether the modal is currently animating out (closing).
 * @property {() => void} openModal - Function to open the modal.
 * @property {() => void} closeModal - Function to close the modal, triggering the closing animation.
 */
export const useModalAnimation = (timeout: number = 250): ModalAnimation => {
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
