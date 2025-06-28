import { FormEvent, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLines, useStations, useSubmitReport } from 'src/api/queries'
import { useLocation } from 'src/contexts/LocationContext'
import { getClosestStations } from 'src/hooks/getClosestStations'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'
import { useStationSearch } from 'src/hooks/useStationSearch'
import { validateReport, ValidationError } from 'src/utils/reportValidation'
import { Report, Station } from 'src/utils/types'

import searchIcon from '../../../public/icons/search.svg'
import FeedbackButton from '../Buttons/FeedbackButton/FeedbackButton'
import StationButton from '../Buttons/StationButton'
import { SubmitButton } from '../common/SubmitButton/SubmitButton'
import { Line } from '../Miscellaneous/Line/Line'
import { CenterModal } from '../Modals/CenterModal'
import { FeedbackForm } from './FeedbackForm/FeedbackForm'
import { SelectField } from './SelectField/SelectField'
import { TextAreaWithPrivacy, TextAreaWithPrivacyRef } from './TextAreaWithPrivacy/TextAreaWithPrivacy'

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

    // Detect firefox as quick fix for textarea not working on mobile
    const userAgent = navigator.userAgent.toLowerCase()
    const isFirefox = userAgent.includes('firefox') || userAgent.includes('fxios') || userAgent.includes('focus')

    const startTime = useRef<number>(Date.now())
    const searchUsed = useRef<boolean>(false)
    const stationRecommendationUsed = useRef<boolean>(false)
    const hadErrors = useRef<boolean>(false)

    const textareaWithPrivacyRef = useRef<TextAreaWithPrivacyRef>(null)
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
    const [textareaContent, setTextareaContent] = useState<string>('')
    const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false)

    const [currentEntity, setCurrentEntity] = useState<Entity>(Entity.ALL)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentDirection, setCurrentDirection] = useState<Station | null>(null)
    const [currentStation, setCurrentStation] = useState<Station | null>(null)

    const { data: linesData } = useLines()
    const allLines = linesData?.map(([line]) => line) ?? []
    const possibleLines = (() => {
        if (currentStation) {
            return allLines.filter((line) => currentStation.lines.includes(line))
        }

        if (currentEntity === Entity.ALL) {
            return allLines
        }

        if (currentEntity === Entity.T) {
            // exception because T stands for tram but we want Metro trams and regular trams
            return allLines.filter((line) => line.startsWith('M') || /^\d+$/.test(line))
        }

        return allLines.filter((line) => line.startsWith(currentEntity))
    })()

    const { data: stationsData } = useStations()
    const allStations: Station[] = useMemo(
        () =>
            stationsData
                ? Object.entries(stationsData)
                      .map(([id, stationProperty]) => ({
                          id,
                          name: stationProperty.name,
                          coordinates: stationProperty.coordinates,
                          lines: stationProperty.lines,
                      }))
                      .sort((a, b) => a.name.localeCompare(b.name))
                : [],
        [stationsData]
    )

    const possibleDirections = useMemo(() => {
        if (!currentLine || !allStations.length || !linesData) return []

        // Find the line data for the current line
        const lineData = linesData.find(([lineName]) => lineName === currentLine)
        if (!lineData) return []

        const [, stationIds] = lineData
        if (stationIds.length === 0) return []
        if (stationIds.length === 1) {
            const [stationId] = stationIds
            const station = allStations.find((s) => s.id === stationId)
            return station ? [station] : []
        }

        // Get first and last station ids from the line data (in correct order)
        const [firstStationId] = stationIds
        const lastStationId = stationIds[stationIds.length - 1]

        // Look up the actual Station objects
        const firstStation = allStations.find((s) => s.id === firstStationId)
        const lastStation = allStations.find((s) => s.id === lastStationId)

        const directions = []
        if (firstStation) directions.push(firstStation)
        if (lastStation && lastStation.id !== firstStation?.id) directions.push(lastStation)

        return directions
    }, [currentLine, allStations, linesData])

    const possibleStations = (() => {
        if (currentStation) {
            return [currentStation]
        }

        if (searchValue.trim() !== '') {
            return filteredStations.filter((station) => !currentLine || station.lines.includes(currentLine))
        }

        const lineFilteredStations = allStations.filter(
            (station) => !currentLine || station.lines.includes(currentLine)
        )

        // If a line is selected, order stations according to the line's station order
        if (currentLine && linesData) {
            const lineData = linesData.find(([lineName]) => lineName === currentLine)
            if (lineData) {
                const [, stationIds] = lineData
                // for quick lookup of station order
                const stationOrderMap = new Map(stationIds.map((id, index) => [id, index]))

                return lineFilteredStations.sort((a, b) => {
                    const orderA = stationOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
                    const orderB = stationOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
                    return orderA - orderB
                })
            }
        }

        return lineFilteredStations
    })()

    const handleStationSelect = (selectedValue: string | null) => {
        const selectedStation = selectedValue ? (possibleStations.find((s) => s.id === selectedValue) ?? null) : null
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
            message: textareaWithPrivacyRef.current?.value ?? '',
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
                message: textareaWithPrivacyRef.current?.value ?? '',
                searchUsed: searchUsed.current,
                stationRecommendationUsed: stationRecommendationUsed.current,
                hadErrors: hadErrors.current,
            },
            duration: (Date.now() - startTime.current) / 1000,
        })
    }

    const isFormValid = currentStation !== null && (!textareaContent.trim() || isPrivacyChecked)

    if (showFeedback) {
        return <FeedbackForm openAnimationClass="open center-animation" />
    }

    return (
        <CenterModal className="h-md:h-[60vh] h-lg:h-[60vh] h-xl:h-[45vh] h-[80vh] max-w-md pb-1" animationType="popup">
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
                        <button
                            type="button"
                            className="h-4 w-4 focus:outline-none"
                            onClick={() => {
                                setIsSearchExpanded(!isSearchExpanded)
                                setSearchValue('')
                                searchUsed.current = true
                            }}
                            aria-label="Toggle search"
                        >
                            <img src={searchIcon} alt="Search" className="h-4 w-4 brightness-0 invert" />
                        </button>
                        <input
                            className={`ml-4 rounded-sm border-2 border-gray-300 transition-[width] duration-300 ${
                                isSearchExpanded ? 'w-48' : 'w-0 border-0 p-0'
                            }`}
                            type="text"
                            placeholder={t('ReportForm.searchPlaceholder')}
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                        />
                    </div>
                </div>
                <div className={`min-h-11 ${currentStation ? '' : 'flex-1'}`}>
                    <div className="h-full overflow-y-auto">
                        {userPosition && currentStation === null && searchValue.trim() === '' ? (
                            <>
                                {getClosestStations(3, possibleStations, userPosition).map((station) => (
                                    <SelectField
                                        key={`recommended${station.id}`}
                                        containerClassName="mb-1"
                                        onSelect={() => {
                                            handleStationSelect(station.id)
                                            stationRecommendationUsed.current = true
                                        }}
                                        value="placeholder since the regular station will be selected"
                                    >
                                        <StationButton
                                            station={station}
                                            data-select-value={station.id}
                                            key={`recommended${station.id}`}
                                        />
                                    </SelectField>
                                ))}
                                <hr className="my-2" />
                            </>
                        ) : null}
                        {possibleStations.map((station) => (
                            <SelectField
                                key={`station${station.id}`}
                                containerClassName="mb-1"
                                onSelect={handleStationSelect}
                                value={currentStation?.id ?? null}
                            >
                                <StationButton
                                    station={station}
                                    data-select-value={station.id}
                                    key={`station${station.id}`}
                                />
                            </SelectField>
                        ))}
                    </div>
                </div>
                {currentStation && currentLine && possibleDirections.length > 0 ? (
                    <section className="mb-2 flex-shrink-0">
                        <h2>{t('ReportForm.direction')}</h2>
                        <SelectField
                            containerClassName="flex items-center justify-between mx-auto w-full overflow-x-visible overflow-y-hidden gap-2"
                            onSelect={(selectedValue) => {
                                const selectedStation = selectedValue
                                    ? (possibleDirections.find((d) => d.id === selectedValue) ?? null)
                                    : null
                                setCurrentDirection(selectedStation)
                            }}
                            value={currentDirection?.id ?? null}
                        >
                            {possibleDirections.map((direction) => (
                                <button
                                    key={`direction${direction.id}`}
                                    type="button"
                                    data-select-value={direction.id}
                                    className="flex h-fit min-w-0 flex-1 items-center justify-start"
                                >
                                    <p className="text-sm font-semibold">{direction.name}</p>
                                </button>
                            ))}
                        </SelectField>
                    </section>
                ) : null}
                {currentStation && !isFirefox ? (
                    <div className="h-sm:block hidden">
                        <section className="mb-2 flex min-h-0 flex-1 flex-col">
                            <h2 className="mb-2 flex-shrink-0">{t('ReportForm.description')}</h2>
                            <TextAreaWithPrivacy
                                ref={textareaWithPrivacyRef}
                                placeholder={t('ReportForm.descriptionPlaceholder')}
                                className="w-full flex-1 resize-none rounded border border-gray-300 p-2"
                                onTextChange={(text) => setTextareaContent(text)}
                                onPrivacyChange={(checked) => setIsPrivacyChecked(checked)}
                                rows={2}
                            />
                        </section>
                    </div>
                ) : null}
                <section className="mt-auto flex-shrink-0">
                    {validationErrors.length > 0 ? (
                        <ul className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-left">
                            {validationErrors.map((error) => (
                                <li key={error.message} className="text-xs text-red-600">
                                    {error.message}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <SubmitButton isValid={isFormValid}>{t('ReportForm.report')}</SubmitButton>
                    <p className="text-xs">{t('ReportForm.syncText')}</p>
                </section>
            </form>
        </CenterModal>
    )
}
