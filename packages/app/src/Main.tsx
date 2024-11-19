import { View } from 'native-base'
import { useEffect } from 'react'

import { FFMapView } from './components/FFMapView'
import { UIOverlay } from './components/UIOverlay'
import { track } from './tracking'

export const Main = () => {
    useEffect(() => {
        track({ name: 'App Opened' })
    }, [])

    return (
        <View width="100%" height="100%">
            <FFMapView />
            <UIOverlay />
        </View>
    )
}
