import { View } from 'native-base'
import { useEffect } from 'react'

import { FFMapView } from './components/FFMapView'
import { UIOverlay } from './components/UIOverlay'
import { trackHit } from './tracking'

export const Main = () => {
    useEffect(trackHit, [])

    return (
        <View width="100%" height="100%">
            <FFMapView />
            <UIOverlay />
        </View>
    )
}
