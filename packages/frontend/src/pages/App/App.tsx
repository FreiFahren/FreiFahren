import React, { useState, useEffect } from 'react';

import Map from '../../components/Map/Map';
import LayerSwitcher from '../../components/Miscellaneous/LayerSwitcher/LayerSwitcher';
import ReportButton from '../../components/Buttons/ReportButton/ReportButton';
import ReportForm from '../../components/Form/ReportForm/ReportForm';
import LegalDisclaimer from '../../components/Modals/LegalDisclaimer/LegalDisclaimer';
import UtilButton from '../../components/Buttons/UtilButton/UtilButton';
import UtilModal from '../../components/Modals/UtilModal/UtilModal';
import StatsPopUp from '../../components/Miscellaneous/StatsPopUp/StatsPopUp';
import AskForLocation from '../../components/Miscellaneous/AskForLocation/AskForLocation';
import { CloseButton } from '../../components/Buttons/CloseButton/CloseButton';
import { highlightElement, useModalAnimation, currentColorTheme, setColorThemeInLocalStorage } from '../../utils/uiUtils';
import Backdrop from '../../components/Miscellaneous/Backdrop/Backdrop';
import { getNumberOfReportsInLast24Hours } from '../../utils/dbUtils';
import './App.css';

type AppUIState = {
  isReportFormOpen: boolean;
  formSubmitted: boolean;
  isFirstOpen: boolean;
  isStatsPopUpOpen: boolean;
  isAskForLocationOpen: boolean;
  currentColorTheme: string;
  isRiskLayerOpen: boolean;
};

const initialAppUIState: AppUIState = {
  isReportFormOpen: false,
  formSubmitted: false,
  isFirstOpen: true,
  isStatsPopUpOpen: false,
  isAskForLocationOpen: false,
  currentColorTheme: currentColorTheme(),
  isRiskLayerOpen: false,
};

function App() {
  const [appUIState, setAppUIState] = useState<AppUIState>(initialAppUIState);
  const [userPosition, setUserPosition] = useState<{ lng: number, lat: number } | null>(null);

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

  const setStationAsUserPosition = (stationCoordinates: { lat: number; lng: number }) => {
    setUserPosition(stationCoordinates);
    setAppUIState(prev => ({ ...prev, isAskForLocationOpen: false }));
  };

  const {
    isOpen: isAskForLocationOpen,
    isAnimatingOut: isAskForLocationAnimatingOut,
    openModal: openAskForLocation,
    closeModal: closeAskForLocation
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

  // add theme class on first render
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(currentColorTheme());
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

  return (
    <div className='App'>
      {appUIState.isFirstOpen &&
        <>
          <LegalDisclaimer
            className={appUIState.isFirstOpen ? 'open center-animation' : ''}
            closeModal={closeLegalDisclaimer}
          />
          <Backdrop onClick={() => highlightElement('legal-disclaimer')} />
        </>}
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
      {appUIState.isReportFormOpen && (
        <>
          <ReportForm
            closeModal={() => setAppUIState({ ...appUIState, isReportFormOpen: false })}
            onFormSubmit={handleFormSubmit}
            className={'open center-animation'}
            userPosition={userPosition}
          />
          <Backdrop onClick={() => setAppUIState({ ...appUIState, isReportFormOpen: false })} />
        </>
      )}

      <Map
        isFirstOpen={appUIState.isFirstOpen}
        formSubmitted={appUIState.formSubmitted}
        userPosition={userPosition}
        setUserPosition={setUserPosition}
        currentColorTheme={appUIState.currentColorTheme}
        openAskForLocation={openAskForLocation}
        isRiskLayerOpen={appUIState.isRiskLayerOpen}
      />
      <LayerSwitcher
        onClick={() => setAppUIState({ ...appUIState, isRiskLayerOpen: !appUIState.isRiskLayerOpen })}
        isRiskLayerOpen={appUIState.isRiskLayerOpen}
      />
      <UtilButton onClick={toggleUtilModal} />
      <ReportButton onClick={() => setAppUIState({ ...appUIState, isReportFormOpen: !appUIState.isReportFormOpen })} />
      {appUIState.isStatsPopUpOpen &&  statsData !== 0 && <StatsPopUp numberOfReports={statsData} className={'open center-animation'} />}
      {isAskForLocationOpen && !appUIState.isFirstOpen &&
        <AskForLocation
          setUserPosition={setStationAsUserPosition}
          className={`open ${isAskForLocationAnimatingOut ? 'slide-out' : 'slide-in'}`}
          closeModal={closeAskForLocation}
        >
          <CloseButton closeModal={closeAskForLocation}></CloseButton>
        </AskForLocation>
      }
    </div>
  );
}

export default App;
