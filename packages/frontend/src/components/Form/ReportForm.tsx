import { FormEvent, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLines, useStations, useSubmitReport } from 'src/api/queries'
import { useLocation } from 'src/contexts/LocationContext'
import { getClosestStations } from 'src/hooks/getClosestStations'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'
import { useStationSearch } from 'src/hooks/useStationSearch'
import { validateReport, ValidationError } from 'src/utils/reportValidation'
import { Line, Report, Station } from 'src/utils/types'

import searchIcon from '../../../public/icons/search.svg'
import FeedbackButton from '../Buttons/FeedbackButton/FeedbackButton'
import StationButton from '../Buttons/StationButton'
import { SubmitButton } from '../common/SubmitButton/SubmitButton'
import { Line as LineTag } from '../Miscellaneous/Line/Line'
import { CenterModal } from '../Modals/CenterModal'
import { FeedbackForm } from './FeedbackForm/FeedbackForm'
import { SelectField } from './SelectField/SelectField'

interface ReportFormProps {
    onReportFormSubmit: (reportedData: Report) => void
}

enum Entity {
    U = 'U',
    S = 'S',
    T = 'T',
    ALL = '',
}

type ReportLineOption = Line & {
    variants: Line[]
}

const getLongestVariant = (variants: Line[]): Line | undefined =>
    variants.reduce<Line | undefined>((longestVariant, variant) => {
        if (!longestVariant) return variant
        return variant.stations.length > longestVariant.stations.length ? variant : longestVariant
    }, undefined)

const getMergedStationIds = (variants: Line[], primaryVariant: Line): string[] => {
    const stationIds = new Set(primaryVariant.stations)
    const mergedStationIds = [...primaryVariant.stations]

    for (const variant of variants) {
        for (const stationId of variant.stations) {
            if (stationIds.has(stationId)) continue

            stationIds.add(stationId)
            mergedStationIds.push(stationId)
        }
    }

    return mergedStationIds
}

const getReportLineOptions = (lines: Line[]): ReportLineOption[] => {
    const linesByName = new Map<string, Line[]>()

    for (const line of lines) {
        linesByName.set(line.name, [...(linesByName.get(line.name) ?? []), line])
    }

    return Array.from(linesByName.values()).map((variants) => {
        const primaryVariant = getLongestVariant(variants) ?? variants[0]

        return {
            ...primaryVariant,
            stations: getMergedStationIds(variants, primaryVariant),
            variants,
        }
    })
}

const getVariantTerminalIds = (variant: Line): string[] => {
    if (variant.stations.length === 0) return []

    const [firstStationId] = variant.stations
    const lastStationId = variant.stations[variant.stations.length - 1]

    return firstStationId === lastStationId ? [firstStationId] : [firstStationId, lastStationId]
}

const getReportLineId = (
    line: ReportLineOption | undefined,
    stationId: string,
    directionId: string | null
): string | null => {
    const stationVariants = (line?.variants ?? []).filter((variant) => variant.stations.includes(stationId))
    const directionVariants =
        directionId === null ? [] : stationVariants.filter((variant) => variant.stations.includes(directionId))

    return getLongestVariant(directionVariants)?.id ?? getLongestVariant(stationVariants)?.id ?? line?.id ?? null
}

export const ReportForm = ({ onReportFormSubmit }: ReportFormProps) => {
    const { t } = useTranslation()
    const [showFeedback, setShowFeedback] = useState<boolean>(false)
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(true)
    const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false)
    const { userPosition } = useLocation()
    const { searchValue, setSearchValue, filteredStations } = useStationSearch()

    const startTime = useRef<number>(Date.now())
    const searchUsed = useRef<boolean>(false)
    const stationRecommendationUsed = useRef<boolean>(false)
    const hadErrors = useRef<boolean>(false)

    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

    const [currentEntity, setCurrentEntity] = useState<Entity>(Entity.ALL)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentDirection, setCurrentDirection] = useState<Station | null>(null)
    const [currentStation, setCurrentStation] = useState<Station | null>(null)

    const { data: linesData } = useLines()
    const allLines = useMemo(() => getReportLineOptions(linesData ?? []), [linesData])
    const currentLineData = allLines.find((line) => line.id === currentLine)
    const possibleLines = (() => {
        if (currentStation) {
            return allLines.filter((line) => line.stations.includes(currentStation.id))
        }

        if (currentEntity === Entity.ALL) {
            return allLines
        }

        if (currentEntity === Entity.T) {
            // exception because T stands for tram but we want Metro trams and regular trams
            return allLines.filter((line) => line.name.startsWith('M') || /^\d+$/.test(line.name))
        }

        return allLines.filter((line) => line.name.startsWith(currentEntity))
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
        if (!currentLineData || !allStations.length) return []

        const variants = currentLineData.variants.filter(
            (variant) => !currentStation || variant.stations.includes(currentStation.id)
        )
        const directionIds = Array.from(new Set(variants.flatMap(getVariantTerminalIds)))

        return directionIds
            .map((stationId) => allStations.find((station) => station.id === stationId))
            .filter((station): station is Station => station !== undefined)
    }, [currentLineData, currentStation, allStations])

    const possibleStations = (() => {
        if (currentStation) {
            return [currentStation]
        }

        if (searchValue.trim() !== '') {
            return filteredStations.filter(
                (station) => !currentLineData || currentLineData.stations.includes(station.id)
            )
        }

        const lineFilteredStations = allStations.filter(
            (station) => !currentLineData || currentLineData.stations.includes(station.id)
        )

        // If a line is selected, order stations according to the line's station order
        if (currentLineData) {
            // for quick lookup of station order
            const stationOrderMap = new Map(currentLineData.stations.map((id, index) => [id, index]))

            return lineFilteredStations.sort((a, b) => {
                const orderA = stationOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
                const orderB = stationOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
                return orderA - orderB
            })
        }

        return lineFilteredStations
    })()

    const handleStationSelect = (selectedValue: string | null) => {
        const selectedStation = selectedValue ? (possibleStations.find((s) => s.id === selectedValue) ?? null) : null
        setCurrentStation(selectedStation)
        setIsSearchExpanded(selectedStation === null) // expand again if user deselects the station
        setIsSearchFocused(false) // Hide search focus when station is selected
        if (selectedStation && currentLineData && !currentLineData.stations.includes(selectedStation.id)) {
            setCurrentLine(null)
            setCurrentDirection(null)
        }

        // Clear validation errors when station changes
        if (validationErrors.length > 0) {
            setValidationErrors([])
        }
    }

    const { mutateAsync: submitReport } = useSubmitReport({
        duration: (Date.now() - startTime.current) / 1000,
        meta: {
            entity: currentEntity,
            searchUsed: searchUsed.current,
            stationRecommendationUsed: stationRecommendationUsed.current,
        },
    })

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!currentStation) return

        // Clear previous validation errors
        setValidationErrors([])

        const validationResult = validateReport(currentStation.coordinates, userPosition, t)
        if (!validationResult.isValid) {
            setValidationErrors(validationResult.errors)
            hadErrors.current = true

            sendAnalyticsEvent('Validation Failed', {
                meta: {
                    errors: JSON.stringify(validationResult.errors),
                },
            })

            return
        }

        const reportLineId = getReportLineId(currentLineData, currentStation.id, currentDirection?.id ?? null)

        const submittedReport = await submitReport({
            stationId: currentStation.id,
            lineId: reportLineId,
            directionId: currentDirection?.id ?? null,
        })

        // If validation passes, submit the report
        localStorage.setItem('lastReportedTime', new Date().toISOString())

        onReportFormSubmit({
            timestamp: submittedReport.timestamp,
            stationId: submittedReport.stationId,
            lineId: submittedReport.lineId,
            directionId: submittedReport.directionId,
            isPredicted: false,
        })
    }

    const isFormValid = currentStation !== null

    if (showFeedback) {
        return <FeedbackForm openAnimationClass="open center-animation" />
    }

    return (
        <CenterModal className="h-md:h-[60vh] h-lg:h-[60vh] h-xl:h-[45vh] h-[80vh] max-w-md pb-1" animationType="popup">
            <form onSubmit={handleSubmit} className="flex h-full flex-col">
                <section
                    className={`mb-2 flex flex-shrink-0 flex-row justify-between transition-all duration-300 ${
                        isSearchFocused ? 'hidden md:block' : ''
                    }`}
                >
                    <h1>{t('ReportForm.title')}</h1>
                    <FeedbackButton handleButtonClick={() => setShowFeedback(!showFeedback)} />
                </section>
                <section
                    className={`mb-2 flex-shrink-0 transition-all duration-300 ${
                        isSearchFocused ? 'hidden md:block' : ''
                    }`}
                >
                    <SelectField
                        containerClassName="flex items-center justify-between mx-auto w-full h-10 gap-2"
                        fieldClassName="flex justify-center items-center"
                        onSelect={(selectedValue) => setCurrentEntity(selectedValue as Entity)}
                        value={currentEntity}
                    >
                        <button type="button" className="flex min-w-0 flex-1 items-center justify-center">
                            <LineTag line="U" />
                        </button>
                        <button type="button" className="flex min-w-0 flex-1 items-center justify-center">
                            <LineTag line="S" />
                        </button>
                        <button type="button" className="flex min-w-0 flex-1 items-center justify-center">
                            <LineTag line="T" />
                        </button>
                    </SelectField>
                </section>
                <section
                    className={`mb-2 flex-shrink-0 transition-all duration-300 ${
                        isSearchFocused ? 'hidden md:block' : ''
                    }`}
                >
                    <h2>{t('ReportForm.line')}</h2>
                    <SelectField
                        containerClassName="flex items-center justify-between mx-auto w-full overflow-x-visible overflow-y-hidden gap-2"
                        onSelect={(selectedValue) => {
                            setCurrentLine(selectedValue)
                            setCurrentDirection(null)
                        }}
                        value={currentLine}
                    >
                        {possibleLines.map((line) => (
                            <button
                                key={line.id}
                                type="button"
                                data-select-value={line.id}
                                className="flex h-fit min-w-0 flex-1 items-center justify-center"
                            >
                                <LineTag line={line.name} />
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
                            onFocus={() => {
                                setIsSearchFocused(true)
                                searchUsed.current = true
                            }}
                            onBlur={() => {
                                // small delay to allow station selection to complete before hiding elements
                                setTimeout(() => {
                                    setIsSearchFocused(false)
                                }, 150)
                            }}
                        />
                    </div>
                </div>
                <div className={`min-h-11 ${currentStation ? '' : 'flex-1'} ${isSearchFocused ? 'flex-1' : ''}`}>
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
                    <section
                        className={`mb-2 flex-shrink-0 transition-all duration-300 ${
                            isSearchFocused ? 'hidden md:block' : ''
                        }`}
                    >
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
                <section
                    className={`mt-auto flex-shrink-0 transition-all duration-300 ${
                        isSearchFocused ? 'hidden md:block' : ''
                    }`}
                >
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
