import './FeedbackForm.css'

import { ChangeEvent, FC, useActionState, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { useFeedback } from '../../../api/queries'
import { useFormValidity } from '../../../hooks/useFormValidity'
import { ContactSection } from '../../Modals/ContactSection/ContactSection'
import { FeedbackSummaryModal } from '../../Modals/FeedbackSummaryModal/FeedbackSummaryModal'
import { PrivacyCheckbox } from '../PrivacyCheckbox/PrivacyCheckbox'

interface FeedbackFormProps {
    openAnimationClass?: string
    onClose?: () => void
}

const FeedbackForm: FC<FeedbackFormProps> = ({ openAnimationClass, onClose }) => {
    const { t } = useTranslation()
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const { mutateAsync: submitFeedback } = useFeedback()
    const [isChecked, setIsChecked] = useState(false)

    const { isValid } = useFormValidity({
        textareaRef,
        isPrivacyChecked: isChecked,
    })

    const formAction = async (previousState: boolean | null, formData: FormData): Promise<boolean> => {
        if (!isValid) {
            return false
        }

        const feedback = formData.get('feedback') as string
        const success = await submitFeedback(feedback)

        if (success) {
            await sendAnalyticsEvent('Feedback submitted', {}).catch(() => {
                // eslint-disable-next-line no-console
                console.error('Failed to send analytics event')
            })
        }

        return success
    }

    const [showSummary, action, isPending] = useActionState(formAction, false)

    const handleInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = event.target
        // Adjust textarea height
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
    }

    if (showSummary) {
        return <FeedbackSummaryModal openAnimationClass={openAnimationClass} handleCloseModal={() => onClose?.()} />
    }

    return (
        <div className={`feedback-form modal container ${openAnimationClass}`}>
            <h1>{t('FeedbackForm.title')}</h1>
            <p className="description">{t('FeedbackForm.description')}</p>
            <form action={action}>
                <textarea
                    ref={textareaRef}
                    name="feedback"
                    placeholder={t('FeedbackForm.descriptionPlaceholder')}
                    onChange={handleInput}
                    rows={1}
                />
                <PrivacyCheckbox isChecked={isChecked} onChange={() => setIsChecked(!isChecked)} />
                <button type="submit" className={isValid ? 'action' : 'button-gray'} disabled={!isValid || isPending}>
                    {isPending ? t('FeedbackForm.submitting') : t('FeedbackForm.submit')}
                </button>
            </form>
            <hr />
            <ContactSection />
        </div>
    )
}

export { FeedbackForm }
