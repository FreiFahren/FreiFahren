import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface TextAreaWithPrivacyProps {
    placeholder?: string
    className?: string
    rows?: number
    onTextChange?: (value: string) => void
    onPrivacyChange?: (isChecked: boolean) => void
    autoResize?: boolean
    name?: string
}

export interface TextAreaWithPrivacyRef {
    value: string | undefined
    isPrivacyChecked: boolean
    textareaRef: HTMLTextAreaElement | null
}

export const TextAreaWithPrivacy = forwardRef<TextAreaWithPrivacyRef, TextAreaWithPrivacyProps>(
    ({ placeholder, className, rows = 4, onTextChange, onPrivacyChange, autoResize = false, name }, ref) => {
        const { t } = useTranslation()
        const textareaRef = useRef<HTMLTextAreaElement>(null)
        const [showPrivacySection, setShowPrivacySection] = useState<boolean>(false)
        const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false)

        useImperativeHandle(ref, () => ({
            get value() {
                return textareaRef.current?.value
            },
            isPrivacyChecked,
            textareaRef: textareaRef.current,
        }))

        const handleTextareaChange = () => {
            const isEmpty = !textareaRef.current?.value || textareaRef.current.value.trim() === ''
            setShowPrivacySection(!isEmpty)

            if (autoResize && textareaRef.current) {
                textareaRef.current.style.height = 'auto'
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
            }

            onTextChange?.(textareaRef.current?.value ?? '')
        }

        const handlePrivacyChange = () => {
            const newCheckedState = !isPrivacyChecked
            setIsPrivacyChecked(newCheckedState)
            onPrivacyChange?.(newCheckedState)
        }

        return (
            <>
                <textarea
                    className={className ?? 'min-h-24 w-full flex-1 resize-none rounded border border-gray-300 p-2'}
                    placeholder={placeholder}
                    ref={textareaRef}
                    onChange={handleTextareaChange}
                    rows={rows}
                    name={name}
                />
                {showPrivacySection ? (
                    <section className="mb-2 mt-1 flex min-h-0 gap-1 text-xs">
                        <input type="checkbox" checked={isPrivacyChecked} onChange={handlePrivacyChange} />
                        <div className="relative">
                            <label htmlFor="privacy">
                                {t('PrivacyCheckbox.privacy1')}{' '}
                                <Link to="/datenschutz" className="underline">
                                    {t('PrivacyCheckbox.privacy2')}
                                </Link>
                                {t('PrivacyCheckbox.privacy3')}
                            </label>
                            <span className="absolute right-[-8px] top-0 text-red-500">*</span>
                        </div>
                    </section>
                ) : null}
            </>
        )
    }
)

// for debugging purposes
TextAreaWithPrivacy.displayName = 'TextAreaWithPrivacy'
