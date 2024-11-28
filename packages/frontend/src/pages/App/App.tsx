import './App.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ReportsModalButton } from 'src/components/Buttons/ReportsModalButton/ReportsModalButton'
import ReportsModal from 'src/components/Modals/ReportsModal/ReportsModal'

import { CloseButton } from '../../components/Buttons/CloseButton/CloseButton'
import { LayerSwitcher } from '../../components/Buttons/LayerSwitcher/LayerSwitcher'
import { ReportButton } from '../../components/Buttons/ReportButton/ReportButton'
import UtilButton from '../../components/Buttons/UtilButton/UtilButton'
import ReportForm from '../../components/Form/ReportForm/ReportForm'
import Map from '../../components/Map/Map'
import { Backdrop } from "../../components/Miscellaneous/Backdrop/Backdrop"
import StatsPopUp from '../../components/Miscellaneous/StatsPopUp/StatsPopUp'
import { LegalDisclaimer } from '../../components/Modals/LegalDisclaimer/LegalDisclaimer'
import { UtilModal } from '../../components/Modals/UtilModal/UtilModal'
import { RiskDataProvider } from '../../contexts/RiskDataContext'
import { StationsAndLinesProvider } from '../../contexts/StationsAndLinesContext'
import { TicketInspectorsProvider } from '../../contexts/TicketInspectorsContext'
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

export const App = () => {
    const [appUIState, setAppUIState] = useState<AppUIState>(initialAppUIState)
    const [appMounted, setAppMounted] = useState(false)

    useEffect(() => {
        setAppMounted(true)
    }, [])

    const handleFormSubmit = () => {
        setAppUIState((currentAppUIState) => ({ ...currentAppUIState, formSubmitted: !appUIState.formSubmitted }))
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
        // eslint-disable-next-line no-console
        sendSavedEvents().catch((error) => console.error('Failed to send saved events:', error))
    }, [])

    // preloading the stats popup data
    const [statsData, setStatsData] = useState<number>(0)

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const numberOfReports = await getNumberOfReportsInLast24Hours()

                if (numberOfReports > 0) {
                    setStatsData(numberOfReports)
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error fetching number of reports:', error)
            }
        }

        // eslint-disable-next-line no-console
        fetchReports().catch((error) => console.error('Failed to fetch reports:', error))
    }, [appUIState])

    const initalTrackingRef = useRef(false)

    useEffect(() => {
        if (initalTrackingRef.current) return

        const initialLayer = localStorage.getItem('layer') ?? 'line'

        sendAnalyticsEvent('Initial Layer View', {
            meta: {
                layer: initialLayer,
            },
            // eslint-disable-next-line no-console
        })
        initalTrackingRef.current = true
    }, [initalTrackingRef])

    const changeLayer = async (clickedLayer: string, source: string = 'layer switcher') => {
        const previousLayer = appUIState.isRiskLayerOpen ? 'risk' : 'line'

        if (previousLayer === clickedLayer) return

        sendAnalyticsEvent('Layer Switch', {
            meta: {
                from: previousLayer,
                to: clickedLayer,
                source,
            },
        })

        setAppUIState((prevState) => ({
            ...prevState,
            isRiskLayerOpen: clickedLayer === 'risk',
        }))
        localStorage.setItem('layer', clickedLayer)
    }

    const handleRiskGridItemClick = () => {
        setAppUIState((prevState) => ({ ...prevState, isListModalOpen: false }))
        // eslint-disable-next-line no-console
        changeLayer('risk', 'reports modal').catch((error) => console.error('Failed to change layer:', error))
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
                <UtilModal
                    className={`open ${isUtilAnimatingOut ? 'slide-out' : 'slide-in'}`}
                    colorTheme={appUIState.currentColorTheme}
                    toggleColorTheme={toggleColorTheme}
                >
                    <CloseButton closeModal={closeUtilModal} />
                </UtilModal>
            )}
            <StationsAndLinesProvider>
                {appUIState.isReportFormOpen && (
                    <>
                        <ReportForm
                            closeModal={() => setAppUIState({ ...appUIState, isReportFormOpen: false })}
                            notifyParentAboutSubmission={handleFormSubmit}
                            className="open center-animation"
                        />
                        <Backdrop onClick={() => setAppUIState({ ...appUIState, isReportFormOpen: false })} />
                    </>
                )}
                <div id="portal-root" />
                <RiskDataProvider>
                    <TicketInspectorsProvider>
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
                                    className="open center-animation"
                                    closeModal={handleRiskGridItemClick}
                                />
                                <Backdrop onClick={() => setAppUIState({ ...appUIState, isListModalOpen: false })} />
                            </>
                        )}
                    </TicketInspectorsProvider>
                </RiskDataProvider>
                <ReportsModalButton openModal={() => setAppUIState({ ...appUIState, isListModalOpen: true })} />
            </StationsAndLinesProvider>
            <UtilButton onClick={toggleUtilModal} />
            {mapsRotation !== 0 && (
                <div className="compass-container">
                    <div className="compass-needle" style={{ transform: `rotate(${mapsRotation}deg)` }}>
                        <div className="arrow upper" />
                        <div className="compass-circle" />
                        <div className="arrow lower" />
                    </div>
                </div>
            )}
            <ReportButton
                openReportModal={() => setAppUIState({ ...appUIState, isReportFormOpen: !appUIState.isReportFormOpen })}
            />
            {appUIState.isStatsPopUpOpen && statsData !== 0 && (
                <StatsPopUp
                    numberOfReports={statsData}
                    className="open center-animation"
                    openListModal={() => setAppUIState({ ...appUIState, isListModalOpen: !appUIState.isListModalOpen })}
                />
            )}
        </div>
    )
}
