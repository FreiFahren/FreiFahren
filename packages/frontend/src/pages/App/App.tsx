import React, { useState, useEffect } from 'react';

import Map from '../../components/Map/Map';
import LayerSwitcher from '../../components/Buttons/LayerSwitcher/LayerSwitcher';
import ReportButton from '../../components/Buttons/ReportButton/ReportButton';
import ReportForm from '../../components/Form/ReportForm/ReportForm';
import LegalDisclaimer from '../../components/Modals/LegalDisclaimer/LegalDisclaimer';
import UtilButton from '../../components/Buttons/UtilButton/UtilButton';
import UtilModal from '../../components/Modals/UtilModal/UtilModal';
import StatsPopUp from '../../components/Miscellaneous/StatsPopUp/StatsPopUp';
import AskForLocation from '../../components/Miscellaneous/AskForLocation/AskForLocation';
import Backdrop from '../../../src/components/Miscellaneous/Backdrop/Backdrop';
import InspectorListButton from 'src/components/Buttons/InspectorListButton/InspectorListButton';
import InspectorListModal from 'src/components/Modals/InspectorListModal/InspectorListModal';

import { TicketInspectorsProvider } from '../../contexts/TicketInspectorsContext'
import { RiskDataProvider } from '../../contexts/RiskDataContext';
import { useLocation } from '../../contexts/LocationContext';
import { StationsAndLinesProvider } from '../../contexts/StationsAndLinesContext';

import { getNumberOfReportsInLast24Hours } from '../../utils/dbUtils'
import { CloseButton } from '../../components/Buttons/CloseButton/CloseButton';
import { highlightElement, currentColorTheme, setColorThemeInLocalStorage } from '../../utils/uiUtils';
import { useModalAnimation } from '../../hooks/UseModalAnimation';
import { sendSavedEvents } from '../../utils/analytics';
import './App.css';

type AppUIState = {
  isReportFormOpen: boolean;
  formSubmitted: boolean;
  isFirstOpen: boolean;
  isStatsPopUpOpen: boolean;
  currentColorTheme: string;
  isRiskLayerOpen: boolean;
  isListModalOpen: boolean;
};

const initialAppUIState: AppUIState = {
  isReportFormOpen: false,
  formSubmitted: false,
  isFirstOpen: true,
  isStatsPopUpOpen: false,
  currentColorTheme: currentColorTheme(),
  isRiskLayerOpen: false,
  isListModalOpen: false,
};

function App() {
  const [appUIState, setAppUIState] = useState<AppUIState>(initialAppUIState);
  const [appMounted, setAppMounted] = useState(false);

  useEffect(() => {
    setAppMounted(true);
  }, []);

  const handleFormSubmit = () => {
    setAppUIState(appUIState => ({ ...appUIState, formSubmitted: !appUIState.formSubmitted }));
  }

  function closeLegalDisclaimer() {
    setAppUIState({ ...appUIState, isFirstOpen: false, isStatsPopUpOpen: true });
  }

  const {
    isOpen: isUtilOpen,
    isAnimatingOut: isUtilAnimatingOut,
    openModal: openUtilModal,
    closeModal: closeUtilModal
  } = useModalAnimation();

  const toggleUtilModal = () => {
    if (isUtilOpen) {
      closeUtilModal();
    } else {
      openUtilModal();
    }
  };

  const { isAskForLocationOpen, closeAskForLocation } = useLocation();


  // Todo: fix this
  const {
    isAnimatingOut: isAskForLocationAnimatingOut,
  } = useModalAnimation();

  function toggleColorTheme() {
    setColorThemeInLocalStorage();
    setAppUIState({ ...appUIState, currentColorTheme: currentColorTheme() });

    // add classes to the root element to change the color theme
    const root = document.documentElement;
    if (currentColorTheme() === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }

  // run on app mount
  useEffect(() => {
    // set the color theme by manipulating the root element
    const root = document.documentElement;
    root.classList.add(currentColorTheme());

    // send saved events to the backend
    sendSavedEvents();
  }, []);

  // preloading the stats popup data
  const [statsData, setStatsData] = useState<number>(0);
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const numberOfReports = await getNumberOfReportsInLast24Hours();
        if (numberOfReports) {
          setStatsData(numberOfReports);
        }
      } catch (error) {
        console.error('Error fetching number of reports:', error);
      }
    };

    fetchReports();
  }, [appUIState]);

  function changeLayer(clickedLayer: string) {
    setAppUIState({ ...appUIState, isRiskLayerOpen: clickedLayer === 'risk' });
  }

  return (
    <div className='App'>
      {appUIState.isFirstOpen && appMounted && (
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
        <div id='portal-root'></div>
        <RiskDataProvider>
          <TicketInspectorsProvider>
              <Map
                isFirstOpen={appUIState.isFirstOpen}
                formSubmitted={appUIState.formSubmitted}
                currentColorTheme={appUIState.currentColorTheme}
                isRiskLayerOpen={appUIState.isRiskLayerOpen}
                />
                <LayerSwitcher
                  changeLayer={changeLayer}
                  isRiskLayerOpen={appUIState.isRiskLayerOpen}
                />
                {appUIState.isListModalOpen && (
                  <>
                    <InspectorListModal className={`open center-animation`}/>
                    <Backdrop onClick={() => setAppUIState({ ...appUIState, isListModalOpen: false })} />
                  </>
                )}
          </TicketInspectorsProvider>
        </RiskDataProvider>
        <InspectorListButton closeModal={() => setAppUIState({...appUIState, isListModalOpen: !appUIState.isListModalOpen})}/>
        {isAskForLocationOpen && !appUIState.isFirstOpen && !appUIState.isReportFormOpen && !appUIState.isListModalOpen && !isUtilOpen && 
          <AskForLocation
            className={`open ${isAskForLocationAnimatingOut ? 'slide-out' : 'slide-in'}`}
            closeModal={closeAskForLocation}
          >
            <CloseButton closeModal={closeAskForLocation}></CloseButton>
          </AskForLocation>
        }
      </StationsAndLinesProvider>
      <UtilButton onClick={toggleUtilModal} />
      <ReportButton onClick={() => setAppUIState({ ...appUIState, isReportFormOpen: !appUIState.isReportFormOpen })} />
      {appUIState.isStatsPopUpOpen &&  statsData !== 0 && <StatsPopUp numberOfReports={statsData} className={'open center-animation'} openListModal={() => setAppUIState({ ...appUIState, isListModalOpen: !appUIState.isListModalOpen })} />}
    </div>
  );
}

export default App;
