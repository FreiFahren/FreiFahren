import { useState } from 'react'

import { CenterModal } from '../../Modal/CenterModal'
import FeedbackButton from '../../Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'

interface ReportFormProps {
    className: string
}

export const ReportForm = ({ className }: ReportFormProps) => {
    const [showFeedback, setShowFeedback] = useState<boolean>(false)

    if (showFeedback) {
        return <FeedbackForm openAnimationClass={className} />
    }

    return (
        <CenterModal className={className}>
            <section className="flex flex-row justify-between">
                <h1>Neue Meldung</h1>
                <FeedbackButton handleButtonClick={() => setShowFeedback(!showFeedback)} />
            </section>
        </CenterModal>
    )
}
