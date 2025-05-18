import './App.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ReportsModalButton } from 'src/components/Buttons/ReportsModalButton/ReportsModalButton'
import NavigationModal from 'src/components/Modals/NavigationModal/NavigationModal'
import { ReportsModal } from 'src/components/Modals/ReportsModal/ReportsModal'
import { ReportSummaryModal } from 'src/components/Modals/ReportSummaryModal/ReportSummaryModal'
import { Itinerary, Report, StationProperty } from 'src/utils/types'

import { useCurrentReports, useLast24HourReports, useStations } from '../../api/queries'
import CloseButton from '../../components/Buttons/CloseButton/CloseButton'
import { LayerSwitcher } from '../../components/Buttons/LayerSwitcher/LayerSwitcher'
import { ReportButton } from '../../components/Buttons/ReportButton/ReportButton'
import { UtilButton } from '../../components/Buttons/UtilButton/UtilButton'
import { ReportForm } from '../../components/Form/ReportForm/ReportForm'
import { FreifahrenMap } from '../../components/Map/Map'
import { Backdrop } from '../../components/Miscellaneous/Backdrop/Backdrop'
import { SearchBar } from '../../components/Miscellaneous/SearchBar/SearchBar'
import { StatsPopUp } from '../../components/Miscellaneous/StatsPopUp/StatsPopUp'
import { InfoModal } from '../../components/Modals/InfoModal/InfoModal'
import { LegalDisclaimer } from '../../components/Modals/LegalDisclaimer/LegalDisclaimer'
import { UtilModal } from '../../components/Modals/UtilModal/UtilModal'
import { ViewedReportsProvider } from '../../contexts/ViewedReportsContext'
import { sendAnalyticsEvent, sendSavedEvents } from '../../hooks/useAnalytics'
import { useModalAnimation } from '../../hooks/UseModalAnimation'
import { highlightElement } from '../../utils/uiUtils'
import MarketingModal from 'src/components/Modals/MarketingModal/MarketingModal'
import { useShouldShowMarketingModal } from '../../hooks/useShouldShowMarketingModal'

type AppUIState = {
    isReportFormOpen: boolean
    isFirstOpen: boolean
    isStatsPopUpOpen: boolean
    isRiskLayerOpen: boolean
    isListModalOpen: boolean
    isLegalDisclaimerOpen: boolean
}

const initialAppUIState: AppUIState = {
    isReportFormOpen: false,
    isFirstOpen: true,
    isStatsPopUpOpen: false,
    isRiskLayerOpen: localStorage.getItem('layer') === 'risk',
    isListModalOpen: false,
    isLegalDisclaimerOpen: false,
}

const isTelegramWebApp = (): boolean =>
    // @ts-ignore since TelegramWebviewProxy is not in the window type definitions
    typeof TelegramWebviewProxy !== 'undefined'

const App = () => {
    const { stationId } = useParams()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const [appUIState, setAppUIState] = useState<AppUIState>(initialAppUIState)
    const [appMounted, setAppMounted] = useState(false)
    const [showUpdateIndicator, setShowUpdateIndicator] = useState<boolean>(false)
    const indicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const [shouldShowMarketingModal, dismissMarketingModal] = useShouldShowMarketingModal()

    const { data: reportsInLast24Hours } = useLast24HourReports()
    const { isFetching: isFetchingCurrentReports } = useCurrentReports()
    const wasFetchingRef = useRef(isFetchingCurrentReports)
    const { data: stations } = useStations()

    useEffect(() => {
        setAppMounted(true)
    }, [])

    const [showSummary, setShowSummary] = useState<boolean>(false)
    const [reportedData, setReportedData] = useState<Report | null>(null)
    const handleReportFormSubmit = (reportedDataForm: Report) => {
        setAppUIState((prevState) => ({ ...prevState, isReportFormOpen: false }))
        setShowSummary(true)
        setReportedData(reportedDataForm)
    }

    const {
        isOpen: isUtilOpen,
        isAnimatingOut: isUtilAnimatingOut,
        openModal: openUtilModal,
        closeModal: closeUtilModal,
    } = useModalAnimation()

    const toggleUtilModal = () => {
        if (isUtilOpen) {
            closeUtilModal()
        } else {
            openUtilModal()
        }
    }

    useEffect(() => {
        sendSavedEvents().catch((error) => {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Failed to send saved events:', error)
        })
    }, [])

    // preloading the stats popup data
    const [statsData, setStatsData] = useState<number>(0)

    useEffect(() => {
        const fetchReports = async () => {
            try {
                if (reportsInLast24Hours.length !== 0) {
                    setStatsData(reportsInLast24Hours.length)
                }
            } catch (error) {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error('Error fetching number of reports:', error)
            }
        }

        fetchReports().catch((error) => {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Error fetching number of reports:', error)
        })
    }, [reportsInLast24Hours.length])

    const initalTrackingRef = useRef(false)

    useEffect(() => {
        if (initalTrackingRef.current) return

        const initialLayer = localStorage.getItem('layer') ?? 'line'

        try {
            sendAnalyticsEvent('Initial Layer View', {
                meta: {
                    layer: initialLayer,
                },
            }).catch((error) => {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error('Failed to send initial layer analytics event:', error)
            })
            initalTrackingRef.current = true
        } catch (error) {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Failed to send initial layer analytics event:', error)
        }
    }, [initalTrackingRef])

    const changeLayer = async (clickedLayer: string, source: string = 'layer switcher') => {
        const previousLayer = appUIState.isRiskLayerOpen ? 'risk' : 'line'

        if (previousLayer === clickedLayer) return

        try {
            await sendAnalyticsEvent('Layer Switch', {
                meta: {
                    from: previousLayer,
                    to: clickedLayer,
                    source,
                },
            })
        } catch (error) {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Failed to send layer switch analytics event:', error)
        }

        setAppUIState((prevState) => ({
            ...prevState,
            isRiskLayerOpen: clickedLayer === 'risk',
        }))
        localStorage.setItem('layer', clickedLayer)
    }

    const onRiskGridItemClick = () => {
        setAppUIState((prevState) => ({ ...prevState, isListModalOpen: false }))
        changeLayer('risk', 'reports modal').catch((error) => {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Failed to change layer to risk:', error)
        })
    }

    const shouldShowLegalDisclaimer = (): boolean => {
        const legalDisclaimerAcceptedAt = localStorage.getItem('legalDisclaimerAcceptedAt')

        if (legalDisclaimerAcceptedAt === null) return true

        const lastAcceptedDate = new Date(legalDisclaimerAcceptedAt)
        const currentDate = new Date()
        const oneWeek = 7 * 24 * 60 * 60 * 1000 // One week in milliseconds

        return currentDate.getTime() - lastAcceptedDate.getTime() > oneWeek
    }

    const closeLegalDisclaimer = useCallback(() => {
        localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString())
        setAppUIState((prevState) => ({ ...prevState, isFirstOpen: false, isStatsPopUpOpen: true }))
    }, [])

    useEffect(() => {
        if (!shouldShowLegalDisclaimer()) {
            setAppUIState({ ...appUIState, isFirstOpen: false, isStatsPopUpOpen: true })
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const [mapsRotation, setMapsRotation] = useState(0)

    const handleRotationChange = useCallback((bearing: number) => {
        setMapsRotation(bearing)
    }, [])

    // we dont know the exact number of users, so we make an estimate that should be close to the actual number
    // in the future this will be automatically fetched from the analytics platform + telegram user count
    const numberOfUsers = useMemo(() => Math.floor(Math.random() * (36000 - 35000 + 1)) + 35000, [])

    useEffect(() => {
        if (isTelegramWebApp()) {
            sendAnalyticsEvent('Opened from Telegram', {
                meta: {},
            }).catch((error) => {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error('Failed to send opened from telegram analytics event:', error)
            })
        }
    }, [])

    const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false)
    const [selectedStation, setSelectedStation] = useState<StationProperty | null>(null)
    const [navigationEndStation, setNavigationEndStation] = useState<StationProperty | null>(null)
    const [stationModalWasManuallyCloses, setStationModalWasManuallyCloses] = useState(false)

    // New state for saved route
    const [savedRoute, setSavedRoute] = useState<Itinerary | null>(null)
    const [showSavedRoute, setShowSavedRoute] = useState(false)

    const {
        isOpen: isInfoModalOpen,
        isAnimatingOut: isInfoModalAnimatingOut,
        openModal: openInfoModal,
        closeModal: closeInfoModal,
    } = useModalAnimation()

    const onStationSelect = useCallback(
        (station: StationProperty) => {
            setSelectedStation(station)
            openInfoModal()
            setStationModalWasManuallyCloses(false)
        },
        [openInfoModal]
    )

    const onCloseInfoModal = () => {
        setStationModalWasManuallyCloses(true)
        closeInfoModal()

        // If we're on a station URL, navigate back to home
        if (stationId !== undefined) {
            navigate('/')
        }
    }

    const handleRouteButtonClick = () => {
        if (selectedStation) {
            setNavigationEndStation(selectedStation)
            setIsNavigationModalOpen(true)
            closeInfoModal()
        }
    }

    // Handle direct navigation to a station via URL parameter
    useEffect(() => {
        const isValidStationId = typeof stationId === 'string' && stationId.trim() !== ''

        if (!(isValidStationId && stations && !isInfoModalOpen && !stationModalWasManuallyCloses)) {
            return
        }
        const station = stations[stationId]

        // station does have an overlap with undefined, when looking for stations[(RANDOM_STRING)], so we need to check for it
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (station === undefined) {
            return
        }

        const hasValidName = typeof station.name === 'string' && station.name.trim() !== ''
        const hasValidCoordinates =
            typeof station.coordinates === 'object' &&
            typeof station.coordinates.longitude === 'number' &&
            typeof station.coordinates.latitude === 'number'

        if (!(hasValidName && hasValidCoordinates)) {
            return
        }

        const stationProperty: StationProperty = {
            name: station.name,
            lines: Array.isArray(station.lines) ? station.lines : [],
            coordinates: {
                longitude: station.coordinates.longitude,
                latitude: station.coordinates.latitude,
            },
        }
        // Make sure legal disclaimer has to be accepted first, before the station view can be opened
        if (appUIState.isFirstOpen) {
            return
        }
        onStationSelect(stationProperty)
    }, [
        stationId,
        stations,
        isInfoModalOpen,
        appUIState.isFirstOpen,
        closeLegalDisclaimer,
        onStationSelect,
        stationModalWasManuallyCloses,
        navigate,
    ])

    useEffect(() => {
        if (indicatorTimeoutRef.current) {
            clearTimeout(indicatorTimeoutRef.current)
        }

        if (wasFetchingRef.current && !isFetchingCurrentReports) {
            setShowUpdateIndicator(true)
            // Set a timeout to hide the indicator after a short period
            indicatorTimeoutRef.current = setTimeout(() => {
                setShowUpdateIndicator(false)
            }, 1.5 * 1000)
        }

        // Update the ref for the next render
        wasFetchingRef.current = isFetchingCurrentReports

        return () => {
            if (indicatorTimeoutRef.current) {
                clearTimeout(indicatorTimeoutRef.current)
            }
        }
    }, [isFetchingCurrentReports])

    return (
        <div className="App">
            {appMounted && shouldShowLegalDisclaimer() ? (
                <>
                    <LegalDisclaimer
                        openAnimationClass={appUIState.isFirstOpen ? 'open center-animation' : ''}
                        handleConfirm={closeLegalDisclaimer}
                    />
                    <Backdrop handleClick={() => highlightElement('legal-disclaimer')} />
                </>
            ) : null}
            {isUtilOpen ? (
                <UtilModal className={`open ${isUtilAnimatingOut ? 'slide-out' : 'slide-in'}`}>
                    <CloseButton handleClose={closeUtilModal} />
                </UtilModal>
            ) : null}
            {showSummary && reportedData ? (
                <>
                    <ReportSummaryModal
                        reportData={reportedData}
                        openAnimationClass="open center-animation"
                        handleCloseModal={() => setShowSummary(false)}
                        numberOfUsers={numberOfUsers}
                    />
                    <Backdrop handleClick={() => setShowSummary(false)} />
                </>
            ) : null}
            {appUIState.isReportFormOpen ? (
                <>
                    <ReportForm onReportFormSubmit={handleReportFormSubmit} className="open center-animation" />
                    <Backdrop handleClick={() => setAppUIState({ ...appUIState, isReportFormOpen: false })} />
                </>
            ) : null}
            {shouldShowMarketingModal ? (
                <MarketingModal className="open center-animation">
                    <CloseButton
                        handleClose={() => {
                            dismissMarketingModal()
                        }}
                    />
                </MarketingModal>
            ) : null}
            <div id="portal-root" />
            <ViewedReportsProvider>
                <FreifahrenMap
                    isFirstOpen={appUIState.isFirstOpen}
                    isRiskLayerOpen={appUIState.isRiskLayerOpen}
                    onRotationChange={handleRotationChange}
                    handleStationClick={onStationSelect}
                />
                <LayerSwitcher changeLayer={changeLayer} isRiskLayerOpen={appUIState.isRiskLayerOpen} />
                {appUIState.isListModalOpen ? (
                    <>
                        <ReportsModal className="open center-animation" handleCloseModal={onRiskGridItemClick} />
                        <Backdrop handleClick={() => setAppUIState({ ...appUIState, isListModalOpen: false })} />
                    </>
                ) : null}
                <ReportsModalButton openModal={() => setAppUIState({ ...appUIState, isListModalOpen: true })} />
            </ViewedReportsProvider>
            <SearchBar handleSelect={onStationSelect} />
            <UtilButton handleClick={toggleUtilModal} />
            {mapsRotation !== 0 ? (
                <div className="compass-container">
                    <div className="compass-needle" style={{ transform: `rotate(${mapsRotation}deg)` }}>
                        <div className="arrow upper" />
                        <div className="compass-circle" />
                        <div className="arrow lower" />
                    </div>
                </div>
            ) : null}
            {isInfoModalOpen && selectedStation ? (
                <InfoModal
                    station={selectedStation}
                    className={`open ${isInfoModalAnimatingOut ? 'slide-out' : 'slide-in'}`}
                    onRouteClick={handleRouteButtonClick}
                >
                    <CloseButton handleClose={onCloseInfoModal} />
                </InfoModal>
            ) : null}
            {isNavigationModalOpen ? (
                <>
                    <NavigationModal
                        className="open center-animation"
                        initialEndStation={navigationEndStation}
                        onSaveRoute={(route: Itinerary) => {
                            setSavedRoute(route)
                            setIsNavigationModalOpen(false)
                            setNavigationEndStation(null)
                        }}
                        savedRoute={savedRoute}
                    />
                    <Backdrop
                        handleClick={() => {
                            setIsNavigationModalOpen(false)
                            setNavigationEndStation(null)
                        }}
                    />
                </>
            ) : null}

            {/* Show Saved Route button - show only when a route is saved */}
            {savedRoute && !isNavigationModalOpen && !showSavedRoute ? (
                <button
                    className="small-button saved-route-button"
                    onClick={() => setShowSavedRoute(true)}
                    type="button"
                >
                    <span>{t('NavigationModal.showSavedRoute')}</span>
                </button>
            ) : null}

            {/* Display saved route modal */}
            {showSavedRoute && savedRoute ? (
                <>
                    <NavigationModal
                        className="open center-animation"
                        initialRoute={savedRoute}
                        onRemoveRoute={() => {
                            setSavedRoute(null)
                            setShowSavedRoute(false)
                        }}
                        savedRoute={savedRoute}
                    />
                    <Backdrop handleClick={() => setShowSavedRoute(false)} />
                </>
            ) : null}

            <button
                className="navigation-button small-button"
                onClick={() => setIsNavigationModalOpen(true)}
                type="button"
            >
                <img src={`${process.env.PUBLIC_URL}/icons/route-svgrepo-com.svg`} alt="Navigation" />
            </button>
            {showUpdateIndicator ? (
                <div className="update-indicator">
                    <img
                        src={`${process.env.PUBLIC_URL}/icons/refresh-svgrepo-com.svg`}
                        alt="Refresh"
                        className="update-indicator-icon"
                    />
                    <div className="update-indicator-text">{t('updateIndicator.text')}</div>
                </div>
            ) : null}
            <ReportButton
                handleOpenReportModal={() =>
                    setAppUIState({ ...appUIState, isReportFormOpen: !appUIState.isReportFormOpen })
                }
            />
            {appUIState.isStatsPopUpOpen && statsData !== 0 ? (
                <StatsPopUp
                    numberOfReports={statsData}
                    numberOfUsers={numberOfUsers}
                    className="open center-animation"
                    openListModal={() => setAppUIState({ ...appUIState, isListModalOpen: !appUIState.isListModalOpen })}
                />
            ) : null}
        </div>
    )
}

export { App }
