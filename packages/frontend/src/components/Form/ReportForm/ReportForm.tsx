import { FormEvent, useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { CenterModal } from '../../Modal/CenterModal'
import FeedbackButton from '../../Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from '../FeedbackForm/FeedbackForm'
import { SelectField } from '../SelectField/SelectField'
import { Line } from '../../Miscellaneous/Line/Line'
import { useLines, useStations } from 'src/api/queries'
import { Report, Station } from 'src/utils/types'
import { getClosestStations } from 'src/hooks/getClosestStations'
import { useLocation } from 'src/contexts/LocationContext'
import { useStationSearch } from 'src/hooks/useStationSearch'
import { validateReport, ValidationError } from 'src/utils/reportValidation'
import searchIcon from '../../../../public/icons/search.svg'
import StationButton from '../../Buttons/StationButton'
import { Link } from 'react-router-dom'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'
import { useSubmitReport } from 'src/api/queries'

interface ReportFormProps {
    onReportFormSubmit: (reportedData: Report) => void
}

enum Entity {
    U = 'U',
    S = 'S',
    T = 'T',
    ALL = '',
}

export const ReportForm = ({ onReportFormSubmit }: ReportFormProps) => {
    const { t } = useTranslation()
    const [showFeedback, setShowFeedback] = useState<boolean>(false)
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(true)
    const { userPosition } = useLocation()
    const { searchValue, setSearchValue, filteredStations } = useStationSearch()
    const { mutate: submitReport } = useSubmitReport()

    const startTime = useRef<number>(Date.now())
    const searchUsed = useRef<boolean>(false)
    const stationRecommendationUsed = useRef<boolean>(false)
    const hadErrors = useRef<boolean>(false)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [showPrivacySection, setShowPrivacySection] = useState<boolean>(false)
    const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false)
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

    const [currentEntity, setCurrentEntity] = useState<Entity>(Entity.ALL)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentDirection, setCurrentDirection] = useState<Station | null>(null)
    const [currentStation, setCurrentStation] = useState<Station | null>(null)

    const { data: linesData } = useLines()
    const allLines = linesData?.map(([line]) => line) ?? []
    const possibleLines = currentStation
        ? allLines.filter((line) => currentStation.lines.includes(line))
        : currentEntity === Entity.ALL || currentEntity === null
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

    const possibleDirections = useMemo(() => {
        if (!currentLine || !allStations.length || !linesData) return []

        // Find the line data for the current line
        const lineData = linesData.find(([lineName]) => lineName === currentLine)
        if (!lineData) return []

        const [, stationIds] = lineData
        if (stationIds.length === 0) return []
        if (stationIds.length === 1) {
            const station = allStations.find((s) => s.id === stationIds[0])
            return station ? [station] : []
        }

        // Get first and last station ids from the line data (in correct order)
        const firstStationId = stationIds[0]
        const lastStationId = stationIds[stationIds.length - 1]

        // Look up the actual Station objects
        const firstStation = allStations.find((s) => s.id === firstStationId)
        const lastStation = allStations.find((s) => s.id === lastStationId)

        const directions = []
        if (firstStation) directions.push(firstStation)
        if (lastStation && lastStation.id !== firstStation?.id) directions.push(lastStation)

        return directions
    }, [currentLine, allStations, linesData])

    let possibleStations = currentStation
        ? [currentStation]
        : searchValue.trim() !== ''
          ? filteredStations.filter((station) => !currentLine || station.lines.includes(currentLine))
          : allStations.filter((station) => !currentLine || station.lines.includes(currentLine))

    const handleStationSelect = (selectedValue: string | null) => {
        const selectedStation = selectedValue ? possibleStations.find((s) => s.id === selectedValue) || null : null
        setCurrentStation(selectedStation)
        setIsSearchExpanded(selectedStation === null) // expand again if user deselects the station

        // Clear validation errors when station changes
        if (validationErrors.length > 0) {
            setValidationErrors([])
        }
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!currentStation) return

        // Clear previous validation errors
        setValidationErrors([])

        const report: Report = {
            timestamp: new Date().toISOString(),
            station: currentStation,
            direction: currentDirection,
            line: currentLine,
            isHistoric: false,
            message: textareaRef.current?.value || '',
        }

        const validationResult = validateReport(report, userPosition, t)
        if (!validationResult.isValid && !import.meta.env.DEV) {
            setValidationErrors(validationResult.errors)
            hadErrors.current = true
            return
        }

        submitReport(report)

        // If validation passes, submit the report
        onReportFormSubmit(report)
        localStorage.setItem('lastReportedTime', new Date().toISOString())
        sendAnalyticsEvent('Report Submitted', {
            meta: {
                entity: currentEntity,
                station: currentStation.name,
                direction: currentDirection?.name,
                line: currentLine,
                message: textareaRef.current?.value || '',
                searchUsed: searchUsed.current,
                stationRecommendationUsed: stationRecommendationUsed.current,
                hadErrors: hadErrors.current,
            },
            duration: (Date.now() - startTime.current) / 1000,
        })
    }

    const isFormValid = currentStation !== null && (!showPrivacySection || isPrivacyChecked)

    if (showFeedback) {
        return <FeedbackForm openAnimationClass={'open center-animation'} />
    }

    const handleTextareaChange = () => {
        const isEmpty = !textareaRef.current?.value || textareaRef.current.value.trim() === ''
        setShowPrivacySection(!isEmpty)
    }

    return (
        <CenterModal
            className={'h-md:h-[60vh] h-lg:h-[50vh] h-xl:h-[45vh] h-[80vh] max-w-md pb-1'}
            animationType="popup"
        >
            <form onSubmit={handleSubmit} className="flex h-full flex-col">
                <section className="mb-2 flex flex-shrink-0 flex-row justify-between">
                    <h1>{t('ReportForm.title')}</h1>
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
                    <h2>{t('ReportForm.line')}</h2>
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
                <div className="flex h-[35px] flex-shrink-0 flex-row items-center justify-between">
                    <div className="relative self-end">
                        <span className="absolute left-14 top-0 text-red-500">*</span>
                        <h2>{t('ReportForm.station')}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <img
                            src={searchIcon}
                            alt="Search"
                            className="h-4 w-4 cursor-pointer brightness-0 invert"
                            onClick={() => {
                                setIsSearchExpanded(!isSearchExpanded)
                                setSearchValue('')
                                searchUsed.current = true
                            }}
                        />
                        <input
                            className={`ml-4 rounded-sm border-2 border-gray-300 transition-[width] duration-300 ${
                                isSearchExpanded ? 'w-48' : 'w-0 border-0 p-0'
                            }`}
                            type="text"
                            placeholder={t('ReportForm.searchPlaceholder')}
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                        />
                    </div>
                </div>
                <div className={`min-h-11 ${currentStation ? '' : 'flex-1'}`}>
                    <div className="h-full overflow-y-auto">
                        {userPosition && currentStation === null && searchValue.trim() === '' && (
                            <>
                                {getClosestStations(3, possibleStations, userPosition).map((station) => (
                                    <SelectField
                                        containerClassName="mb-1"
                                        onSelect={() => {
                                            handleStationSelect(station.id)
                                            stationRecommendationUsed.current = true
                                        }}
                                        value={'placeholder since the regular station will be selected'}
                                    >
                                        <StationButton
                                            station={station}
                                            data-select-value={station.id}
                                            key={'recommended' + station.id}
                                        />
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
                                <StationButton
                                    station={station}
                                    data-select-value={station.id}
                                    key={'station' + station.id}
                                />
                            </SelectField>
                        ))}
                    </div>
                </div>
                {currentStation && currentLine && possibleDirections.length > 0 && (
                    <section className="mb-2 flex-shrink-0">
                        <h2>{t('ReportForm.direction')}</h2>
                        <SelectField
                            containerClassName="flex items-center justify-between mx-auto w-full overflow-x-visible overflow-y-hidden gap-2"
                            onSelect={(selectedValue) => {
                                const selectedStation = selectedValue
                                    ? possibleDirections.find((d) => d.id === selectedValue) || null
                                    : null
                                setCurrentDirection(selectedStation)
                            }}
                            value={currentDirection?.id || null}
                        >
                            {possibleDirections.map((direction) => (
                                <button
                                    key={'direction' + direction.id}
                                    type="button"
                                    data-select-value={direction.id}
                                    className="flex h-fit min-w-0 flex-1 items-center justify-start"
                                >
                                    <p className="text-sm font-semibold">{direction.name}</p>
                                </button>
                            ))}
                        </SelectField>
                    </section>
                )}
                {currentStation && (
                    <div className="h-sm:block hidden">
                        <section className="mb-2 flex min-h-0 flex-1 flex-col">
                            <h2 className="mb-2 flex-shrink-0">{t('ReportForm.description')}</h2>
                            <textarea
                                className="w-full flex-1 resize-none rounded border border-gray-300 p-2"
                                placeholder={t('ReportForm.descriptionPlaceholder')}
                                ref={textareaRef}
                                onChange={handleTextareaChange}
                            />
                        </section>
                        {showPrivacySection && (
                            <section className="mb-2 flex min-h-0 gap-1 text-xs">
                                <input
                                    type="checkbox"
                                    checked={isPrivacyChecked}
                                    onChange={() => setIsPrivacyChecked(!isPrivacyChecked)}
                                />
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
                        )}
                    </div>
                )}
                <section className="mt-auto flex-shrink-0">
                    {validationErrors.length > 0 && (
                        <ul className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-left">
                            {validationErrors.map((error, index) => (
                                <li key={index} className="text-xs text-red-600">
                                    {error.message}
                                </li>
                            ))}
                        </ul>
                    )}
                    <button className={isFormValid ? 'button-active' : 'button-inactive'} type="submit">
                        <p>{t('ReportForm.report')}</p>
                    </button>
                    <p className="text-xs">{t('ReportForm.syncText')}</p>
                </section>
            </form>
        </CenterModal>
    )
}
