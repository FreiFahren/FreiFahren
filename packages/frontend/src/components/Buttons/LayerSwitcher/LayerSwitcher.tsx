import React, {useState, useCallback} from 'react';

import './LayerSwitcher.css';
import Backdrop from '../../../../src/components/Miscellaneous/Backdrop/Backdrop';

interface LayerSwitcherProps {
   changeLayer: (layer: string) => void;
   isRiskLayerOpen: boolean;
}

const LayerSwitcher: React.FC<LayerSwitcherProps> = ({ changeLayer, isRiskLayerOpen }) => {
  const [areLayerOptionsVisible, setAreLayerOptionsVisible] = useState(false);

  const closeModalAndHighlightSelectedLayer = useCallback((layer: string) => {
    changeLayer(layer);
    setAreLayerOptionsVisible(false);
  }, [changeLayer]);

   return (
    <>
      <button
        className='layer-switcher small-button'
        onClick={() => setAreLayerOptionsVisible(!areLayerOptionsVisible)}
      >
        <svg width='38' height='38' viewBox='0 0 38 38' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M19.7085 1.75047C19.2627 1.5276 18.7381 1.5276 18.2922 1.75047L2.45896 9.66713C1.92256 9.93533 1.58371 10.4836 1.58371 11.0833C1.58371 11.683 1.92256 12.2313 2.45896 12.4995L18.2922 20.4161C18.7381 20.639 19.2627 20.639 19.7085 20.4161L35.5419 12.4995C36.0781 12.2313 36.417 11.683 36.417 11.0833C36.417 10.4836 36.0781 9.93533 35.5419 9.66713L19.7085 1.75047Z' fill='black'/>
        <path d='M1.75084 26.2086C2.14191 25.4264 3.09297 25.1094 3.87511 25.5004L19.0003 33.063L34.1256 25.5004C34.9078 25.1094 35.8589 25.4264 36.2498 26.2086C36.6409 26.9906 36.3239 27.9417 35.5417 28.3328L19.7084 36.2495C19.2627 36.4724 18.738 36.4724 18.2923 36.2495L2.45894 28.3328C1.67681 27.9417 1.35978 26.9906 1.75084 26.2086Z' fill='black'/>
        <path d='M3.87511 17.5837C3.09297 17.1928 2.14191 17.5097 1.75084 18.2919C1.35978 19.0739 1.67681 20.025 2.45894 20.4161L18.2923 28.3328C18.738 28.5557 19.2627 28.5557 19.7084 28.3328L35.5417 20.4161C36.3239 20.025 36.6409 19.0739 36.2498 18.2919C35.8589 17.5097 34.9078 17.1928 34.1256 17.5837L19.0003 25.1463L3.87511 17.5837Z' fill='black'/>
        </svg>
      </button>

      {areLayerOptionsVisible && (
        <>
          <Backdrop onClick={()=> setAreLayerOptionsVisible(false)} BackgroundColor={'rgba(0, 0, 0, 0)'}/>
        </>
      )}
      <div className={`layer-options small-button align-child-on-line ${areLayerOptionsVisible ? 'visible': ''}`}>
        <div onClick={()=> closeModalAndHighlightSelectedLayer('risk')}>
          <img
            src={process.env.PUBLIC_URL + '/icons/risk.png'}
            alt='Showing how the risk layer looks like'
            className={isRiskLayerOpen ? 'active' : ''}
          />
          <p>Risiko</p>
        </div>
        <div onClick={()=> closeModalAndHighlightSelectedLayer('line')}>
          <img
            src={process.env.PUBLIC_URL + '/icons/lines.png'}
            alt='Showing how the line layer looks like'
            className={isRiskLayerOpen ? '' : 'active'}
          />
          <p>Linien</p>
        </div>
      </div>
    </>
   );
};

export default LayerSwitcher;
