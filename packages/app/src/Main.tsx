import { useEffect } from 'react'

import { useAppStore } from './app.store'
import { FFView } from './components/common/base'
import { DeprecationScreen } from './components/DeprecationScreen'
import { FFMapView } from './components/FFMapView'
import { UIOverlay } from './components/UIOverlay'
import { usePersistLanguage } from './persistLanguage'
import { trackHit } from './tracking'

export const Main = () => {
    useEffect(trackHit, [])
    usePersistLanguage()

    const isDeprecated = useAppStore(({ deprecated }) => deprecated)

    return (
        <FFView width="100%" height="100%">
            {isDeprecated === true ? (
                <DeprecationScreen />
            ) : (
                <>
                    <FFMapView />
                    <UIOverlay />
                </>
            )}
        </FFView>
    )
}
