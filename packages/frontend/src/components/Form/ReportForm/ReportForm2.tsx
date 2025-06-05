import { useState } from 'react'

import { CenterModal } from '../../Modal/CenterModal'
import FeedbackButton from '../../Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'
import { SelectField } from '../SelectField/SelectField'
import { Line } from '../../Miscellaneous/Line/Line'
import { useLines } from 'src/api/queries'

interface ReportFormProps {
    className: string
}

enum Entity {
    U = 'U',
    S = 'S',
    T = 'T',
    ALL = '',
}

export const ReportForm = ({ className }: ReportFormProps) => {
    const [showFeedback, setShowFeedback] = useState<boolean>(false)

    const [currentEntity, setCurrentEntity] = useState<Entity>(Entity.ALL)
    const [currentLine, setCurrentLine] = useState<string>('')

    const { data: linesData } = useLines()
    const allLines = linesData?.map(([line]) => line) ?? []
    const possibleLines =
        currentEntity === Entity.ALL
            ? allLines
            : currentEntity === Entity.T // exception because T stands for tram but we want Metro trams and regular trams
              ? allLines.filter((line) => line.startsWith('M') || /^\d+$/.test(line))
              : allLines.filter((line) => line.startsWith(currentEntity))

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
                    onSelect={(selectedValue) => setCurrentEntity(selectedValue as Entity)}
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
            <section>
                <h2>Linie</h2>
                <SelectField
                    containerClassName="flex items-center justify-between mx-auto w-full overflow-x-visible overflow-y-hidden gap-2"
                    onSelect={(selectedValue) => setCurrentLine(selectedValue ?? '')}
                    value={currentLine}
                >
                    {possibleLines.map((line) => (
                        <button key={line} className="flex h-fit min-w-0 flex-1 items-center justify-center">
                            <Line line={line} />
                        </button>
                    ))}
                </SelectField>
            </section>
        </CenterModal>
    )
}
