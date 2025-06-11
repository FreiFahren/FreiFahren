import { FormEvent, useState } from 'react'

import { CenterModal } from '../../Modal/CenterModal'
import FeedbackButton from '../../Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'
import { SelectField } from '../SelectField/SelectField'
import { Line } from '../../Miscellaneous/Line/Line'
import { useLines, useStations } from 'src/api/queries'
import { Report, Station } from 'src/utils/types'

interface ReportFormProps {
    className: string
    onReportFormSubmit: (reportedData: Report) => void
}

enum Entity {
    U = 'U',
    S = 'S',
    T = 'T',
    ALL = '',
}

export const ReportForm = ({ className, onReportFormSubmit }: ReportFormProps) => {
    const [showFeedback, setShowFeedback] = useState<boolean>(false)

    const [currentEntity, setCurrentEntity] = useState<Entity>(Entity.ALL)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentStation, setCurrentStation] = useState<Station | null>(null)

    const { data: linesData } = useLines()
    const allLines = linesData?.map(([line]) => line) ?? []
    const possibleLines =
        currentEntity === Entity.ALL || currentEntity === null
            ? allLines
            : currentEntity === Entity.T // exception because T stands for tram but we want Metro trams and regular trams
              ? allLines.filter((line) => line.startsWith('M') || /^\d+$/.test(line))
              : allLines.filter((line) => line.startsWith(currentEntity))

    const { data: stationsData } = useStations()
    // todo: allStations should be array of Station (station.id exists)
    const allStations = stationsData ?? {}

    // todo: replace with actual isValid hook
    const isButtonActive = currentStation !== null

    // todo: add actual location check
    // todo: send analytics event
    // todo: actually submit the report
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        onReportFormSubmit({
            timestamp: new Date().toISOString(),
            station: {
                id: 'TODO',
                name: 'TODO',
                coordinates: {
                    latitude: 0,
                    longitude: 0,
                },
            },
            direction: null,
            line: currentLine,
            isHistoric: false,
            message: 'TODO',
        })
    }

    if (showFeedback) {
        return <FeedbackForm openAnimationClass={className} />
    }

    return (
        <CenterModal className={className + ' h-[80dvh] pb-1'}>
            <form onSubmit={handleSubmit} className="flex h-full flex-col">
                <section className="mb-2 flex flex-shrink-0 flex-row justify-between">
                    <h1>Neue Meldung</h1>
                    <FeedbackButton handleButtonClick={() => setShowFeedback(!showFeedback)} />
                </section>
                <section className="mb-2 flex-shrink-0">
                    <SelectField
                        containerClassName="flex items-center justify-between mx-auto w-full h-10 gap-2"
                        fieldClassName="flex justify-center items-center"
                        onSelect={(selectedValue) => setCurrentEntity(selectedValue as Entity)}
                        value={currentEntity}
                    >
                        <button type="button" className="flex min-w-0 flex-1 items-center justify-center">
                            <Line line="U" />
                        </button>
                        <button type="button" className="flex min-w-0 flex-1 items-center justify-center">
                            <Line line="S" />
                        </button>
                        <button type="button" className="flex min-w-0 flex-1 items-center justify-center">
                            <Line line="T" />
                        </button>
                    </SelectField>
                </section>
                <section className="mb-2 flex-shrink-0">
                    <h2>Linie</h2>
                    <SelectField
                        containerClassName="flex items-center justify-between mx-auto w-full overflow-x-visible overflow-y-hidden gap-2"
                        onSelect={(selectedValue) => setCurrentLine(selectedValue ?? '')}
                        value={currentLine}
                    >
                        {possibleLines.map((line) => (
                            <button
                                key={line}
                                type="button"
                                className="flex h-fit min-w-0 flex-1 items-center justify-center"
                            >
                                <Line line={line} />
                            </button>
                        ))}
                    </SelectField>
                </section>
                <section className="mb-2 flex flex-shrink-0 flex-col">
                    <div className="relative mb-2">
                        <span className="absolute left-14 top-0 text-red-500">*</span>
                        <h2>Station</h2>
                    </div>
                </section>
                <section className="mb-2 min-h-0 flex-1">
                    <div className="h-full overflow-y-auto">
                        {Array.from({ length: 100 }, (_, i) => (
                            <div
                                key={i}
                                className="mb-2 flex h-fit min-w-0 flex-1 items-center justify-center border border-red-100 p-2"
                            >
                                <p>Alexanderplatz</p>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="flex-shrink-0">
                    <button className={isButtonActive ? 'button-active' : 'button-inactive'} type="submit">
                        <p>Melden</p>
                    </button>
                    <p className="text-xs">Die Meldung wird mit @FreiFahren_BE synchronisiert.</p>
                </section>
            </form>
        </CenterModal>
    )
}
