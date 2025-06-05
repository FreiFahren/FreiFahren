import { useState } from 'react'

import { CenterModal } from '../../Modal/CenterModal'
import FeedbackButton from '../../Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'
import { SelectField } from '../SelectField/SelectField'
import { Line } from '../../Miscellaneous/Line/Line'

interface ReportFormProps {
    className: string
}

export const ReportForm = ({ className }: ReportFormProps) => {
    const [showFeedback, setShowFeedback] = useState<boolean>(false)
    const [currentEntity, setCurrentEntity] = useState<string>('')

    if (showFeedback) {
        return <FeedbackForm openAnimationClass={className} />
    }

    return (
        <CenterModal className={className}>
            <section className="flex flex-row justify-between">
                <h1>Neue Meldung</h1>
                <FeedbackButton handleButtonClick={() => setShowFeedback(!showFeedback)} />
            </section>
            <section>
                <SelectField
                    containerClassName="flex items-center justify-between mx-auto w-full h-10 gap-2"
                    fieldClassName="flex justify-center items-center"
                    onSelect={(selectedValue) => setCurrentEntity(selectedValue ?? '')}
                    value={currentEntity}
                >
                    <button className="flex min-w-0 flex-1 items-center justify-center">
                        <Line line="U" />
                    </button>
                    <button className="flex min-w-0 flex-1 items-center justify-center">
                        <Line line="S" />
                    </button>
                    <button className="flex min-w-0 flex-1 items-center justify-center">
                        <Line line="T" />
                    </button>
                </SelectField>
            </section>
        </CenterModal>
    )
}
