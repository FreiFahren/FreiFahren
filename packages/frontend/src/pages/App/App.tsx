import './App.css'

import { useCallback, useEffect, useMemo,useRef,useState } from 'react'
import { ReportsModalButton } from 'src/components/Buttons/ReportsModalButton/ReportsModalButton'
import { ReportsModal } from 'src/components/Modals/ReportsModal/ReportsModal'
import { ReportSummaryModal } from 'src/components/Modals/ReportSummaryModal/ReportSummaryModal'
import { Report } from 'src/utils/types'

import { CloseButton } from '../../components/Buttons/CloseButton/CloseButton'
import { LayerSwitcher } from '../../components/Buttons/LayerSwitcher/LayerSwitcher'
import { ReportButton } from '../../components/Buttons/ReportButton/ReportButton'
import { UtilButton } from '../../components/Buttons/UtilButton/UtilButton'
import { ReportForm } from '../../components/Form/ReportForm/ReportForm'
import { FreifahrenMap } from '../../components/Map/Map'
import { Backdrop } from '../../components/Miscellaneous/Backdrop/Backdrop'
import { StatsPopUp } from '../../components/Miscellaneous/StatsPopUp/StatsPopUp'
import { LegalDisclaimer } from '../../components/Modals/LegalDisclaimer/LegalDisclaimer'
import { UtilModal } from '../../components/Modals/UtilModal/UtilModal'
import { RiskDataProvider } from '../../contexts/RiskDataContext'
import { StationsAndLinesProvider } from '../../contexts/StationsAndLinesContext'
import { TicketInspectorsProvider } from '../../contexts/TicketInspectorsContext'
import { ViewedReportsProvider } from '../../contexts/ViewedReportsContext'
import { useModalAnimation } from '../../hooks/UseModalAnimation'
import { sendAnalyticsEvent, sendSavedEvents } from '../../utils/analytics'
import { getNumberOfReportsInLast24Hours } from '../../utils/databaseUtils'
import { currentColorTheme, highlightElement, setColorThemeInLocalStorage } from '../../utils/uiUtils'

type AppUIState = {
    isReportFormOpen: boolean
    formSubmitted: boolean
    isFirstOpen: boolean
    isStatsPopUpOpen: boolean
    currentColorTheme: string
    isRiskLayerOpen: boolean
    isListModalOpen: boolean
    isLegalDisclaimerOpen: boolean
}

const initialAppUIState: AppUIState = {
    isReportFormOpen: false,
    formSubmitted: false,
    isFirstOpen: true,
    isStatsPopUpOpen: false,
    currentColorTheme: currentColorTheme(),
    isRiskLayerOpen: localStorage.getItem('layer') === 'risk',
    isListModalOpen: false,
    isLegalDisclaimerOpen: false,
}

const App = () => {
    const [appUIState, setAppUIState] = useState<AppUIState>(initialAppUIState)
    const [appMounted, setAppMounted] = useState(false)

    useEffect(() => {
        setAppMounted(true)
    }, [])

    const [showSummary, setShowSummary] = useState<boolean>(false)
    const [reportedData, setReportedData] = useState<Report | null>(null)
    const handleReportFormSubmit = (reportedDataForm: Report) => {
        setAppUIState((appUIStateCurrent) => ({ ...appUIStateCurrent, formSubmitted: !appUIStateCurrent.formSubmitted }))
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

    const toggleColorTheme = () => {
        setColorThemeInLocalStorage()
        setAppUIState({ ...appUIState, currentColorTheme: currentColorTheme() })

        // add classes to the root element to change the color theme
        const root = document.documentElement

        if (currentColorTheme() === 'light') {
            root.classList.add('light')
            root.classList.remove('dark')
        } else {
            root.classList.add('dark')
            root.classList.remove('light')
        }
    }

    // run on app mount
    useEffect(() => {
        // set the color theme by manipulating the root element
        const root = document.documentElement

        root.classList.add(currentColorTheme())

        // send saved events to the backend
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
                const numberOfReports = await getNumberOfReportsInLast24Hours()

                if (numberOfReports !== 0) {
                    setStatsData(numberOfReports)
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
    }, [appUIState])

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

    const handleRiskGridItemClick = () => {
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

    const closeLegalDisclaimer = () => {
        localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString())
        setAppUIState({ ...appUIState, isFirstOpen: false, isStatsPopUpOpen: true })
    }

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

    return (
        <div className="App">
            {appMounted && shouldShowLegalDisclaimer() ? <>
                    <LegalDisclaimer
                        openAnimationClass={appUIState.isFirstOpen ? 'open center-animation' : ''}
                        handleConfirm={closeLegalDisclaimer}
                    />
                    <Backdrop handleClick={() => highlightElement('legal-disclaimer')} />
                </> : null}
            {isUtilOpen ? <UtilModal
                        className={`open ${isUtilAnimatingOut ? 'slide-out' : 'slide-in'}`}
                        colorTheme={appUIState.currentColorTheme}
                        handleColorThemeToggle={toggleColorTheme}
                    >
                        <CloseButton handleClose={closeUtilModal} />
                    </UtilModal> : null}
            {showSummary && reportedData ? <>
                    <ReportSummaryModal
                        reportData={reportedData}
                        openAnimationClass="open center-animation"
                        handleCloseModal={() => setShowSummary(false)}
                        numberOfUsers={numberOfUsers}
                    />
                    <Backdrop handleClick={() => setShowSummary(false)} />
                </> : null}
            <StationsAndLinesProvider>
                {appUIState.isReportFormOpen ? <>
                        <ReportForm
                            closeModal={() => setAppUIState({ ...appUIState, isReportFormOpen: false })}
                            onNotifyParentAboutSubmission={handleReportFormSubmit}
                            className="open center-animation"
                        />
                        <Backdrop handleClick={() => setAppUIState({ ...appUIState, isReportFormOpen: false })} />
                    </> : null}
                <div id="portal-root" />
                <RiskDataProvider>
                    <TicketInspectorsProvider>
                        <ViewedReportsProvider>
                            <FreifahrenMap
                                isFirstOpen={appUIState.isFirstOpen}
                                formSubmitted={appUIState.formSubmitted}
                                currentColorTheme={appUIState.currentColorTheme}
                                isRiskLayerOpen={appUIState.isRiskLayerOpen}
                                onRotationChange={handleRotationChange}
                            />
                            <LayerSwitcher changeLayer={changeLayer} isRiskLayerOpen={appUIState.isRiskLayerOpen} />
                            {appUIState.isListModalOpen ? <>
                                    <ReportsModal
                                        className="open center-animation"
                                        onCloseModal={handleRiskGridItemClick}
                                    />
                                    <Backdrop handleClick={() => setAppUIState({ ...appUIState, isListModalOpen: false })} />
                                </> : null}
                            <ReportsModalButton
                                openModal={() => setAppUIState({ ...appUIState, isListModalOpen: true })}
                            />
                        </ViewedReportsProvider>
                    </TicketInspectorsProvider>
                </RiskDataProvider>
            </StationsAndLinesProvider>
            <UtilButton handleClick={toggleUtilModal} />
            {mapsRotation !== 0 ? <div className="compass-container">
                    <div className="compass-needle" style={{ transform: `rotate(${mapsRotation}deg)` }}>
                        <div className="arrow upper" />
                        <div className="compass-circle" />
                        <div className="arrow lower" />
                    </div>
                </div> : null}
            <ReportButton
                handleOpenReportModal={() => setAppUIState({ ...appUIState, isReportFormOpen: !appUIState.isReportFormOpen })}
            />
            {appUIState.isStatsPopUpOpen && statsData !== 0 ? <StatsPopUp
                    numberOfReports={statsData}
                    numberOfUsers={numberOfUsers}
                    className="open center-animation"
                    openListModal={() => setAppUIState({ ...appUIState, isListModalOpen: !appUIState.isListModalOpen })}
                /> : null}
        </div>
    )
}

export { App }
