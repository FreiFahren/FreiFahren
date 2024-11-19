import { noop } from 'lodash'
import { View } from 'native-base'
import { useEffect } from 'react'

import { FFMapView } from './components/FFMapView'
import { UIOverlay } from './components/UIOverlay'
import { client } from './tracking'

export const Main = () => {
    useEffect(() => {
        client.hit().catch(noop)
    }, [])

    return (
        <View width="100%" height="100%">
            <FFMapView />
            <UIOverlay />
        </View>
    )
}
