import { FormEvent, useState } from 'react'

import { CenterModal } from '../../Modal/CenterModal'
import FeedbackButton from '../../Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'
import { SelectField } from '../SelectField/SelectField'
import { Line } from '../../Miscellaneous/Line/Line'
import { useLines, useStations } from 'src/api/queries'
import { Report, Station } from 'src/utils/types'
import { getClosestStations } from 'src/hooks/getClosestStations'
import { useLocation } from 'src/contexts/LocationContext'
import { useStationSearch } from 'src/hooks/useStationSearch'
import searchIcon from '../../../../public/icons/search.svg'

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
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(true)
    const { userPosition } = useLocation()

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
    const allStations: Station[] = stationsData
        ? Object.entries(stationsData)
              .map(([id, stationProperty]) => ({
                  id,
                  name: stationProperty.name,
                  coordinates: stationProperty.coordinates,
                  lines: stationProperty.lines,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
        : []

    const { searchValue, setSearchValue, filteredStations } = useStationSearch()

    let possibleStations = currentStation
        ? [currentStation]
        : searchValue.trim() !== ''
          ? filteredStations.filter((station) => !currentLine || station.lines.includes(currentLine))
          : allStations.filter((station) => !currentLine || station.lines.includes(currentLine))

    const handleStationSelect = (selectedValue: string | null) => {
        const selectedStation = selectedValue ? possibleStations.find((s) => s.id === selectedValue) || null : null
        setCurrentStation(selectedStation)
        setIsSearchExpanded(selectedStation === null) // expand again if user deselects the station
    }

    // todo: add actual location check
    // todo: send analytics event
    // todo: actually submit the report
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!currentStation) return

        onReportFormSubmit({
            timestamp: new Date().toISOString(),
            station: currentStation,
            direction: null,
            line: currentLine,
            isHistoric: false,
            message: 'TODO',
        })
    }

    // todo: replace with actual isValid hook
    const isButtonActive = currentStation !== null

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
                <div className="mb-2 flex flex-shrink-0 flex-row items-center justify-between">
                    <div className="relative">
                        <span className="absolute left-14 top-0 text-red-500">*</span>
                        <h2>Station</h2>
                    </div>
                    <div className="flex h-[28px] items-center gap-2">
                        <img
                            src={searchIcon}
                            alt="Search"
                            className="h-4 w-4 cursor-pointer brightness-0 invert"
                            onClick={() => {
                                setIsSearchExpanded(!isSearchExpanded)
                                setSearchValue('')
                            }}
                        />
                        <input
                            className={`ml-4 rounded-sm border-2 border-gray-300 transition-[width] duration-300 ${
                                isSearchExpanded ? 'w-48' : 'w-0 border-0 p-0'
                            }`}
                            type="text"
                            placeholder="Suche nach einer Station..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                        />
                    </div>
                </div>
                <div className="mb-2 min-h-0 flex-1">
                    <div className="h-full overflow-y-auto">
                        {userPosition && currentStation === null && searchValue.trim() === '' && (
                            <>
                                {getClosestStations(3, possibleStations, userPosition).map((station) => (
                                    <SelectField
                                        containerClassName="mb-1"
                                        onSelect={handleStationSelect}
                                        value={'placeholder since the regular station will be selected'}
                                    >
                                        <button
                                            key={station.id}
                                            type="button"
                                            data-select-value={station.id}
                                            className="flex h-fit min-w-0 flex-1 items-center justify-start"
                                        >
                                            <p className="text-sm font-semibold">{station.name}</p>
                                        </button>
                                    </SelectField>
                                ))}
                                <hr className="my-2" />
                            </>
                        )}
                        {possibleStations.map((station) => (
                            <SelectField
                                containerClassName="mb-1"
                                onSelect={handleStationSelect}
                                value={currentStation?.id || null}
                            >
                                <button
                                    key={station.id}
                                    type="button"
                                    data-select-value={station.id}
                                    className="flex h-fit min-w-0 flex-1 items-center justify-start"
                                >
                                    <p className="text-sm font-semibold">{station.name}</p>
                                </button>
                            </SelectField>
                        ))}
                    </div>
                </div>
                <section className="flex-shrink-0">
                    <button className={isButtonActive ? 'button-active' : 'button-inactive'} type="submit">
                        <p>Melden</p>
                    </button>
                    <p className="text-xs">Meldung wird mit @FreiFahren_BE synchronisiert.</p>
                </section>
            </form>
        </CenterModal>
    )
}
