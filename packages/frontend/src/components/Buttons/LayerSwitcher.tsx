import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Backdrop } from '../Miscellaneous/Backdrop/Backdrop'

interface LayerSwitcherProps {
    changeLayer: (layer: string) => void
    isRiskLayerOpen: boolean
}

const LayerSwitcher: React.FC<LayerSwitcherProps> = ({ changeLayer, isRiskLayerOpen }) => {
    const { t } = useTranslation()
    const [areLayerOptionsVisible, setAreLayerOptionsVisible] = useState(false)

    const closeModalAndHighlightSelectedLayer = useCallback(
        async (selectedLayer: string) => {
            changeLayer(selectedLayer)
            setAreLayerOptionsVisible(false)
        },
        [changeLayer]
    )

    return (
        <>
            <button
                type="button"
                className="bg-background fixed right-[15px] top-[80px] z-0 flex h-[45px] w-[100px] cursor-pointer items-center justify-center rounded-2xl border-2 border-black shadow-xl"
                onClick={() => setAreLayerOptionsVisible(!areLayerOptionsVisible)}
                aria-label="Button to open the layer switcher"
            >
                <p>{t('LayerSwitcher.mode')}</p>
                <img src="/icons/layers.svg" alt="Layers" className="ml-1" />
            </button>
            {areLayerOptionsVisible ? (
                <Backdrop handleClick={() => setAreLayerOptionsVisible(false)} BackgroundColor="rgba(0, 0, 0, 0)" />
            ) : null}
            <div
                className={`bg-background duration-250 fixed right-[135px] top-[65px] flex h-[60px] w-fit cursor-pointer flex-row rounded-2xl border-2 border-black p-1 shadow-xl transition-opacity ${areLayerOptionsVisible ? 'z-[2] opacity-100' : 'z-0 opacity-0'}`}
            >
                <div
                    className="flex h-[50px] w-[50px] flex-col items-center justify-center"
                    {...(areLayerOptionsVisible ? { onClick: () => closeModalAndHighlightSelectedLayer('risk') } : {})}
                >
                    <img
                        src="/icons/risk.png"
                        alt="Showing how the risk layer looks like"
                        className={`h-[35px] w-[35px] border-2 ${isRiskLayerOpen ? 'rounded-xl border-gray-300' : 'border-transparent'}`}
                        draggable={areLayerOptionsVisible}
                    />
                    <p className="text-xs">{t('LayerSwitcher.risk')}</p>
                </div>
                <div
                    className="flex h-[50px] w-[50px] flex-col items-center justify-center"
                    {...(areLayerOptionsVisible ? { onClick: () => closeModalAndHighlightSelectedLayer('line') } : {})}
                >
                    <img
                        src="/icons/lines.png"
                        alt="Showing how the line layer looks like"
                        className={`h-[35px] w-[35px] border-2 ${!isRiskLayerOpen ? 'rounded-xl border-gray-300' : 'border-transparent'}`}
                        draggable={areLayerOptionsVisible}
                    />
                    <p className="text-xs">{t('LayerSwitcher.lines')}</p>
                </div>
            </div>
        </>
    )
}

export { LayerSwitcher }
