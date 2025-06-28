import './FeedbackForm.css'

import { FC, useActionState, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useFeedback } from '../../../api/queries'
import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { SubmitButton } from '../../common/SubmitButton/SubmitButton'
import { ContactSection } from '../../Modals/ContactSection/ContactSection'
import { FeedbackSummaryModal } from '../../Modals/FeedbackSummaryModal/FeedbackSummaryModal'
import { TextAreaWithPrivacy, TextAreaWithPrivacyRef } from '../TextAreaWithPrivacy/TextAreaWithPrivacy'

interface FeedbackFormProps {
    openAnimationClass: string
    onClose?: () => void
}

const FeedbackForm: FC<FeedbackFormProps> = ({ openAnimationClass, onClose }) => {
    const { t } = useTranslation()
    const textareaWithPrivacyRef = useRef<TextAreaWithPrivacyRef>(null)
    const { mutateAsync: submitFeedback } = useFeedback()
    const [textareaContent, setTextareaContent] = useState<string>('')
    const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false)

    const isValid = !!textareaContent.trim() && isPrivacyChecked

    const formAction = async (_prevState: boolean, formData: FormData): Promise<boolean> => {
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

    if (showSummary) {
        return <FeedbackSummaryModal openAnimationClass={openAnimationClass} handleCloseModal={() => onClose?.()} />
    }

    return (
        <div className={`feedback-form modal container ${openAnimationClass}`}>
            <h1>{t('FeedbackForm.title')}</h1>
            <p className="description">{t('FeedbackForm.description')}</p>
            <form action={action}>
                <TextAreaWithPrivacy
                    ref={textareaWithPrivacyRef}
                    placeholder={t('FeedbackForm.descriptionPlaceholder')}
                    rows={1}
                    autoResize
                    name="feedback"
                    onTextChange={(text) => setTextareaContent(text)}
                    onPrivacyChange={(checked) => setIsPrivacyChecked(checked)}
                />
                <SubmitButton isValid={isValid} disabled={!isValid || isPending}>
                    {isPending ? t('FeedbackForm.submitting') : t('FeedbackForm.submit')}
                </SubmitButton>
            </form>
            <hr />
            <ContactSection />
        </div>
    )
}

export { FeedbackForm }
