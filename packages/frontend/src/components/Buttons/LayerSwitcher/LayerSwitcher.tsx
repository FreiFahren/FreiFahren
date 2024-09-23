import React, { useState, useCallback } from 'react'

import './LayerSwitcher.css'
import Backdrop from '../../../../src/components/Miscellaneous/Backdrop/Backdrop'
import { sendAnalyticsEvent } from '../../../../src/utils/analytics'

interface LayerSwitcherProps {
    changeLayer: (layer: string) => void
    isRiskLayerOpen: boolean
}

const LayerSwitcher: React.FC<LayerSwitcherProps> = ({ changeLayer, isRiskLayerOpen }) => {
    const [areLayerOptionsVisible, setAreLayerOptionsVisible] = useState(false)

    const closeModalAndHighlightSelectedLayer = useCallback(
        async (layer: string) => {
            changeLayer(layer)
            setAreLayerOptionsVisible(false)

            if (layer === 'risk' && !isRiskLayerOpen) {
                try {
                    await sendAnalyticsEvent('Risk Layer Opened')
                } catch (error) {
                    console.error('Failed to send analytics event:', error)
                }
            }
        },
        [changeLayer, isRiskLayerOpen]
    )

    return (
        <>
            <button
                className="layer-switcher small-button align-child-on-line"
                onClick={() => setAreLayerOptionsVisible(!areLayerOptionsVisible)}
                aria-label="Button to open the layer switcher"
            >
                <p>Modus</p>
                <img src={process.env.PUBLIC_URL + '/icons/layers.svg'} alt="Layers" />
            </button>
            {areLayerOptionsVisible && (
                <>
                    <Backdrop onClick={() => setAreLayerOptionsVisible(false)} BackgroundColor={'rgba(0, 0, 0, 0)'} />
                </>
            )}
            <div
                className={`layer-options small-button align-child-on-line ${areLayerOptionsVisible ? 'visible' : ''}`}
            >
                <div onClick={areLayerOptionsVisible ? () => closeModalAndHighlightSelectedLayer('risk') : undefined}>
                    <img
                        src={process.env.PUBLIC_URL + '/icons/risk.png'}
                        alt="Showing how the risk layer looks like"
                        className={isRiskLayerOpen ? 'active' : ''}
                        draggable={areLayerOptionsVisible}
                    />
                    <p>Risiko</p>
                </div>
                <div onClick={areLayerOptionsVisible ? () => closeModalAndHighlightSelectedLayer('line') : undefined}>
                    <img
                        src={process.env.PUBLIC_URL + '/icons/lines.png'}
                        alt="Showing how the line layer looks like"
                        className={isRiskLayerOpen ? '' : 'active'}
                        draggable={areLayerOptionsVisible}
                    />
                    <p>Linien</p>
                </div>
            </div>
        </>
    )
}

export default LayerSwitcher
