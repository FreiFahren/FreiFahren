import { useEffect } from 'react'

import { FFView } from './components/common/base'
import { FFMapView } from './components/FFMapView'
import { UIOverlay } from './components/UIOverlay'
import { trackHit } from './tracking'

export const Main = () => {
    useEffect(trackHit, [])

    return (
        <FFView width="100%" height="100%">
            <FFMapView />
            <UIOverlay />
        </FFView>
    )
}
