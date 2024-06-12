import './LayerSwitcher.css';

interface LayerSwitcherProps {
   onClick: () => void;
   isRiskLayerOpen: boolean;
}

const LayerSwitcher: React.FC<LayerSwitcherProps> = ({ onClick, isRiskLayerOpen }) => {
   return (
     <button className='layer-switcher small-button' onClick={onClick}>
        {isRiskLayerOpen
        ? <div>
            <svg className='lines' xmlns='http://www.w3.org/2000/svg'  width='44' height='44' viewBox='0 0 24 24' stroke-width='1.5' stroke='#000000' fill='none' stroke-linecap='round' stroke-linejoin='round'>
              <path stroke='none' d='M0 0h24v24H0z' fill='none'/>
              <path d='M4 15l11 -11m5 5l-11 11m-4 -8l7 7m-3.5 -10.5l7 7m-3.5 -10.5l7 7' />
            </svg>
            <p>Linien</p>
          </div>
        :
        <div>
          <svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24' stroke-width='1.5' stroke='#000000' fill='none' stroke-linecap='round' stroke-linejoin='round'>
              <path stroke='none' d='M0 0h24v24H0z' fill='none'/>
              <path d='M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0' />
              <path d='M21 21l-6 -6' />
              <path d='M10 13v.01' />
              <path d='M10 7v3' />
          </svg>
          <p>Risiko</p>
        </div>}
     </button>
   );
};

export default LayerSwitcher;
