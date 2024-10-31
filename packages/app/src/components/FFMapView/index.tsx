import MapLibreGL, { Camera, MapView, UserLocation, UserTrackingMode } from '@maplibre/maplibre-react-native'
import Geolocation from '@react-native-community/geolocation'
import { noop } from 'lodash'
import { View } from 'native-base'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'

import { useReports } from '../../api'
import { useAppStore } from '../../app.store'
import { config } from '../../config'
import { LinesLayer } from './LinesLayer'
import { ReportsLayer } from './ReportsLayer'
import { RiskLayer } from './RiskLayer'
import { StationLayer } from './StationLayer'
import { RouteLayer } from './RouteLayer'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
MapLibreGL.setAccessToken(null)

const MAP_REGION = {
    longitude: 13.40587,
    latitude: 52.51346,
    bounds: {
        ne: [13.88044556529124, 52.77063424239867],
        sw: [12.8364646484805, 52.23115511676795],
    },
}

const styles = StyleSheet.create({
    map: {
        flex: 1,
        alignSelf: 'stretch',
    },
})

export const FFMapView = () => {
    const { data: reports = [] } = useReports()
    const { layer, disclaimerGood, update: updateAppState } = useAppStore()

    useEffect(() => {
        Geolocation.requestAuthorization(noop, noop)
    }, [])

    return (
        <View width="100%" height="100%">
            <MapView
                style={styles.map}
                logoEnabled={false}
                styleURL={config.MAP_STYLE_URL}
                compassEnabled={false}
                attributionEnabled={false}
                rotateEnabled={false}
            >
                <Camera
                    defaultSettings={{
                        centerCoordinate: [MAP_REGION.longitude, MAP_REGION.latitude],
                        zoomLevel: 10,
                    }}
                    maxBounds={MAP_REGION.bounds}
                    minZoomLevel={7}
                    maxZoomLevel={13}
                    followUserMode={UserTrackingMode.Follow}
                />
                <LinesLayer />
                <RiskLayer visible={disclaimerGood && layer === 'risk'} />
                <RouteLayer />
                <StationLayer />
                <ReportsLayer
                    visible={disclaimerGood}
                    reports={reports}
                    onPressReport={(report) => updateAppState({ reportToShow: report })}
                />
                <UserLocation visible animated />
            </MapView>
        </View>
    )
}
