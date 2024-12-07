import React, { useState, useEffect, useCallback, useRef } from 'react'

import Map from '../../components/Map/Map'
import LayerSwitcher from '../../components/Buttons/LayerSwitcher/LayerSwitcher'
import ReportButton from '../../components/Buttons/ReportButton/ReportButton'
import ReportForm from '../../components/Form/ReportForm/ReportForm'
import LegalDisclaimer from '../../components/Modals/LegalDisclaimer/LegalDisclaimer'
import UtilButton from '../../components/Buttons/UtilButton/UtilButton'
import UtilModal from '../../components/Modals/UtilModal/UtilModal'
import StatsPopUp from '../../components/Miscellaneous/StatsPopUp/StatsPopUp'
import Backdrop from '../../../src/components/Miscellaneous/Backdrop/Backdrop'
import ReportsModalButton from 'src/components/Buttons/ReportsModalButton/ReportsModalButton'
import ReportsModal from 'src/components/Modals/ReportsModal/ReportsModal'
import ReportSummaryModal from 'src/components/Modals/ReportSummaryModal/ReportSummaryModal'
import { TicketInspectorsProvider } from '../../contexts/TicketInspectorsContext'
import { RiskDataProvider } from '../../contexts/RiskDataContext'
import { StationsAndLinesProvider } from '../../contexts/StationsAndLinesContext'
import { ViewedReportsProvider } from '../../contexts/ViewedReportsContext'

import { getNumberOfReportsInLast24Hours } from '../../utils/dbUtils'
import { CloseButton } from '../../components/Buttons/CloseButton/CloseButton'
import { highlightElement, currentColorTheme, setColorThemeInLocalStorage } from '../../utils/uiUtils'
import { useModalAnimation } from '../../hooks/UseModalAnimation'
import { sendAnalyticsEvent, sendSavedEvents } from '../../utils/analytics'

import './App.css'
import { simplifiedMarkerData } from 'src/utils/types'

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

function App() {
    const [appUIState, setAppUIState] = useState<AppUIState>(initialAppUIState)
    const [appMounted, setAppMounted] = useState(false)

    useEffect(() => {
        setAppMounted(true)
    }, [])

    const [showSummary, setShowSummary] = useState<boolean>(false)
    const [reportedData, setReportedData] = useState<simplifiedMarkerData | null>(null)
    const handleReportFormSubmit = (reportedData: simplifiedMarkerData) => {
        setAppUIState((appUIState) => ({ ...appUIState, formSubmitted: !appUIState.formSubmitted }))
        setShowSummary(true)
        setReportedData(reportedData)
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

    function toggleColorTheme() {
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
        sendSavedEvents()
    }, [])

    // preloading the stats popup data
    const [statsData, setStatsData] = useState<number>(0)
    useEffect(() => {
        const fetchReports = async () => {
            try {
                const numberOfReports = await getNumberOfReportsInLast24Hours()
                if (numberOfReports) {
                    setStatsData(numberOfReports)
                }
            } catch (error) {
                console.error('Error fetching number of reports:', error)
            }
        }

        fetchReports()
    }, [appUIState])

    const initalTrackingRef = useRef(false)
    useEffect(() => {
        if (initalTrackingRef.current) return

        const initialLayer = localStorage.getItem('layer') || 'line'
        try {
            sendAnalyticsEvent('Initial Layer View', {
                meta: {
                    layer: initialLayer,
                },
            })
            initalTrackingRef.current = true
        } catch (error) {
            console.error('Failed to send initial layer analytics event:', error)
        }
    }, [initalTrackingRef])

    async function changeLayer(clickedLayer: string, source: string = 'layer switcher') {
        const previousLayer = appUIState.isRiskLayerOpen ? 'risk' : 'line'

        if (previousLayer === clickedLayer) return

        try {
            await sendAnalyticsEvent('Layer Switch', {
                meta: {
                    from: previousLayer,
                    to: clickedLayer,
                    source: source,
                },
            })
        } catch (error) {
            console.error('Failed to send layer switch analytics event:', error)
        }

        setAppUIState((prevState) => ({
            ...prevState,
            isRiskLayerOpen: clickedLayer === 'risk',
        }))
        localStorage.setItem('layer', clickedLayer)
    }

    function handleRiskGridItemClick() {
        setAppUIState((prevState) => ({ ...prevState, isListModalOpen: false }))
        changeLayer('risk', 'reports modal')
    }

    const shouldShowLegalDisclaimer = (): boolean => {
        const legalDisclaimerAcceptedAt = localStorage.getItem('legalDisclaimerAcceptedAt')
        if (!legalDisclaimerAcceptedAt) return true

        const lastAcceptedDate = new Date(legalDisclaimerAcceptedAt)
        const currentDate = new Date()
        const oneWeek = 7 * 24 * 60 * 60 * 1000 // One week in milliseconds

        return currentDate.getTime() - lastAcceptedDate.getTime() > oneWeek
    }

    function closeLegalDisclaimer() {
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

    return (
        <div className="App">
            {appMounted && shouldShowLegalDisclaimer() && (
                <>
                    <LegalDisclaimer
                        openAnimationClass={appUIState.isFirstOpen ? 'open center-animation' : ''}
                        closeModal={closeLegalDisclaimer}
                    />
                    <Backdrop onClick={() => highlightElement('legal-disclaimer')} />
                </>
            )}
            {isUtilOpen && (
                <>
                    <UtilModal
                        className={`open ${isUtilAnimatingOut ? 'slide-out' : 'slide-in'}`}
                        colorTheme={appUIState.currentColorTheme}
                        toggleColorTheme={toggleColorTheme}
                    >
                        <CloseButton closeModal={closeUtilModal} />
                    </UtilModal>
                </>
            )}
            {showSummary && reportedData && (
                <>
                    <ReportSummaryModal reportData={reportedData} openAnimationClass="open center-animation" />
                    <Backdrop onClick={() => setShowSummary(false)} />
                </>
            )}
            <StationsAndLinesProvider>
                {appUIState.isReportFormOpen && (
                    <>
                        <ReportForm
                            closeModal={() => setAppUIState({ ...appUIState, isReportFormOpen: false })}
                            notifyParentAboutSubmission={handleReportFormSubmit}
                            className={'open center-animation'}
                        />
                        <Backdrop onClick={() => setAppUIState({ ...appUIState, isReportFormOpen: false })} />
                    </>
                )}
                <div id="portal-root"></div>
                <RiskDataProvider>
                    <TicketInspectorsProvider>
                        <ViewedReportsProvider>
                            <Map
                                isFirstOpen={appUIState.isFirstOpen}
                                formSubmitted={appUIState.formSubmitted}
                                currentColorTheme={appUIState.currentColorTheme}
                                isRiskLayerOpen={appUIState.isRiskLayerOpen}
                                onRotationChange={handleRotationChange}
                            />
                            <LayerSwitcher changeLayer={changeLayer} isRiskLayerOpen={appUIState.isRiskLayerOpen} />
                            {appUIState.isListModalOpen && (
                                <>
                                    <ReportsModal
                                        className={`open center-animation`}
                                        closeModal={handleRiskGridItemClick}
                                    />
                                    <Backdrop
                                        onClick={() => setAppUIState({ ...appUIState, isListModalOpen: false })}
                                    />
                                </>
                            )}
                            <ReportsModalButton
                                openModal={() => setAppUIState({ ...appUIState, isListModalOpen: true })}
                            />
                        </ViewedReportsProvider>
                    </TicketInspectorsProvider>
                </RiskDataProvider>
            </StationsAndLinesProvider>
            <UtilButton onClick={toggleUtilModal} />
            {mapsRotation !== 0 && (
                <div className="compass-container">
                    <div className="compass-needle" style={{ transform: `rotate(${mapsRotation}deg)` }}>
                        <div className="arrow upper"></div>
                        <div className="compass-circle"></div>
                        <div className="arrow lower"></div>
                    </div>
                </div>
            )}
            <ReportButton
                openReportModal={() => setAppUIState({ ...appUIState, isReportFormOpen: !appUIState.isReportFormOpen })}
            />
            {appUIState.isStatsPopUpOpen && statsData !== 0 && (
                <StatsPopUp
                    numberOfReports={statsData}
                    className={'open center-animation'}
                    openListModal={() => setAppUIState({ ...appUIState, isListModalOpen: !appUIState.isListModalOpen })}
                />
            )}
        </div>
    )
}

export default App
