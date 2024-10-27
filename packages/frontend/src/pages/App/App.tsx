import React, { useState, useEffect, useCallback } from 'react'

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

import { TicketInspectorsProvider } from '../../contexts/TicketInspectorsContext'
import { RiskDataProvider } from '../../contexts/RiskDataContext'
import { StationsAndLinesProvider } from '../../contexts/StationsAndLinesContext'

import { getNumberOfReportsInLast24Hours } from '../../utils/dbUtils'
import { CloseButton } from '../../components/Buttons/CloseButton/CloseButton'
import { highlightElement, currentColorTheme, setColorThemeInLocalStorage } from '../../utils/uiUtils'
import { useModalAnimation } from '../../hooks/UseModalAnimation'
import { sendSavedEvents } from '../../utils/analytics'

import './App.css'

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

    const handleFormSubmit = () => {
        setAppUIState((appUIState) => ({ ...appUIState, formSubmitted: !appUIState.formSubmitted }))
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

    function changeLayer(clickedLayer: string) {
        setAppUIState({ ...appUIState, isRiskLayerOpen: clickedLayer === 'risk' })
        localStorage.setItem('layer', clickedLayer)
    }

    function handleRiskGridItemClick() {
        localStorage.setItem('layer', 'risk')
        setAppUIState((prevState) => ({
            ...prevState,
            isListModalOpen: false,
            isRiskLayerOpen: localStorage.getItem('layer') === 'risk',
        }))
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
            <StationsAndLinesProvider>
                {appUIState.isReportFormOpen && (
                    <>
                        <ReportForm
                            closeModal={() => setAppUIState({ ...appUIState, isReportFormOpen: false })}
                            notifyParentAboutSubmission={handleFormSubmit}
                            className={'open center-animation'}
                        />
                        <Backdrop onClick={() => setAppUIState({ ...appUIState, isReportFormOpen: false })} />
                    </>
                )}
                <div id="portal-root"></div>
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
                                    className={`open center-animation`}
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
                    <div className="compass-needle">
                        <div className="arrow upper"></div>
                        <div className="arrow lower"></div>
                    </div>
                </div>
            )}
            <ReportButton
                onClick={() => setAppUIState({ ...appUIState, isReportFormOpen: !appUIState.isReportFormOpen })}
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
