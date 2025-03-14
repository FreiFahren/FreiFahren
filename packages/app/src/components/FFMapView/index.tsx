import MapLibreGL, { Camera, CameraRef, MapView, UserLocation, UserTrackingMode } from '@maplibre/maplibre-react-native'
import Geolocation from '@react-native-community/geolocation'
import { isNil, noop } from 'lodash'
import { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'

import { Report, useReports } from '../../api'
import { useLines, useRiskData, useSegments, useStations } from '../../api/queries'
import { useAppStore } from '../../app.store'
import { config } from '../../config'
import { track } from '../../tracking'
import { FFView } from '../common/base'
import { LinesLayer } from './LinesLayer'
import { ReportsLayer } from './ReportsLayer'
import { RiskLayer } from './RiskLayer'
import { StationLayer } from './StationLayer'

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

// Workaround: Because Maplibre native does not have zIndex and layers are rendered
// in order of their creation. Thus, we need to force the order they are mounted
// independendly of the order the data loads in.
const useLayersToRender = () => {
    const { data: lines } = useLines()
    const { data: segments } = useSegments()
    const { data: riskData } = useRiskData()
    const { data: stations } = useStations()
    const { data: reports } = useReports()

    const hasLines = lines !== undefined
    const hasSegments = segments !== undefined
    const hasRiskData = riskData !== undefined
    const hasStations = stations !== undefined
    const hasReports = reports !== undefined

    return {
        lines: hasLines,
        risk: hasLines && hasSegments && hasRiskData,
        stations: hasLines && hasSegments && hasStations,
        reports: hasLines && hasSegments && hasRiskData && hasStations && hasReports,
    }
}

export const FFMapView = () => {
    const cameraRef = useRef<CameraRef>(null)
    const stations = useStations().data
    const { data: reports = [] } = useReports()

    useEffect(() => {
        Geolocation.requestAuthorization(noop, noop)
    }, [])

    const { layer, reportToShow, update: updateAppState } = useAppStore()

    const layersToRender = useLayersToRender()

    useEffect(() => {
        if (!isNil(reportToShow) && stations !== undefined) {
            const { latitude, longitude } = stations[reportToShow.stationId].coordinates

            cameraRef.current?.setCamera({
                centerCoordinate: [longitude, latitude],
                zoomLevel: 13,
                animationDuration: 700,
                animationMode: 'easeTo',
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportToShow, stations === undefined])

    const onPressReport = (report: Report) => {
        track({ name: 'Report Tapped', station: report.stationId })
        updateAppState({ reportToShow: report })
    }

    return (
        <FFView width="100%" height="100%">
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
                    minZoomLevel={9}
                    maxZoomLevel={13}
                    followUserMode={UserTrackingMode.Follow}
                    ref={cameraRef}
                />
                {layersToRender.lines && <LinesLayer />}
                {layersToRender.risk && <RiskLayer visible={layer === 'risk'} />}
                {layersToRender.stations && <StationLayer />}
                {layersToRender.reports && <ReportsLayer reports={reports} onPressReport={onPressReport} />}
                <UserLocation visible animated />
            </MapView>
        </FFView>
    )
}
