import './FeedbackForm.css'

import React, { FC } from 'react'

import { ContactSection } from '../../Modals/ContactSection/ContactSection'
import { useTranslation } from 'react-i18next'

interface FeedbackFormProps {
    openAnimationClass?: string
}

const FeedbackForm: FC<FeedbackFormProps> = ({ openAnimationClass }) => {
    const { t } = useTranslation()

    return (
        <div className={`feedback-form modal container ${openAnimationClass}`}>
            <h1>{t('FeedbackForm.title')}</h1>
            <ContactSection />
        </div>
    )
}

export { FeedbackForm }
