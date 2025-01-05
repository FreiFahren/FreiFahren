import { useCallback, useEffect, useRef, useState } from 'react'

interface ValidationConfig {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    isPrivacyChecked: boolean
}

/**
 * A hook that handles form validation with refs to minimize re-renders.
 * It only updates the isValid state when the actual validity status changes.
 * Automatically watches for changes in the textarea value and privacy checkbox.
 *
 * @param config - Configuration object containing refs and state to validate
 * @returns Object containing isValid state
 */
export const useFormValidity = (config: ValidationConfig) => {
    const [isValid, setIsValid] = useState(false)
    const previousValidityRef = useRef(false)
    const textareaContentRef = useRef('')

    // Update the stored textarea content
    const updateTextareaContent = useCallback(() => {
        const newContent = config.textareaRef.current?.value.trim() || ''
        if (newContent !== textareaContentRef.current) {
            textareaContentRef.current = newContent
            return true
        }
        return false
    }, [config.textareaRef])

    // Check if the form is valid and update state if changed
    const checkValidity = useCallback(() => {
        const hasContent = textareaContentRef.current.length > 0
        const currentValidity = hasContent && config.isPrivacyChecked

        if (currentValidity !== previousValidityRef.current) {
            setIsValid(currentValidity)
            previousValidityRef.current = currentValidity
        }
    }, [config.isPrivacyChecked])

    // Watch for textarea content changes
    useEffect(() => {
        const textarea = config.textareaRef.current
        if (!textarea) return

        const handleInput = () => {
            const contentChanged = updateTextareaContent()
            if (contentChanged) {
                checkValidity()
            }
        }

        // Initial content check
        updateTextareaContent()
        checkValidity()

        // Setup listeners
        textarea.addEventListener('input', handleInput)
        return () => textarea.removeEventListener('input', handleInput)
    }, [config.textareaRef, updateTextareaContent, checkValidity])

    // Watch for privacy checkbox changes
    useEffect(() => {
        checkValidity()
    }, [config.isPrivacyChecked, checkValidity])

    return { isValid }
}
