import { CircleLayer, MarkerView, ShapeSource } from '@maplibre/maplibre-react-native'
import { useTheme } from '@shopify/restyle'
import { isNil } from 'lodash'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'

import { Report } from '../../api'
import { useStations } from '../../api/queries'
import { useAppStore } from '../../app.store'
import { Theme } from '../../theme'

const styles = StyleSheet.create({
    pulse: {
        backgroundColor: 'red',
        width: 25,
        height: 25,
        borderRadius: 9999,
    },
    marker: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
})

// Workaround: Map pan performance issue when showing markers immediately
const useShowMarkersWithDelay = () => {
    const [showMarkers, setShowMarkers] = useState(false)

    useEffect(() => {
        const timeout = setTimeout(() => setShowMarkers(true), 100)

        return () => clearTimeout(timeout)
    }, [])

    return showMarkers
}

const usePulseAnimation = () => {
    const pulse = useSharedValue(0)

    useEffect(() => {
        pulse.value = withRepeat(
            withDelay(
                1000,
                withTiming(1, {
                    duration: 1000,
                    easing: Easing.linear,
                })
            ),
            -2,
            false
        )
    }, [pulse])

    return useAnimatedStyle(() => ({
        opacity: interpolate(pulse.value, [0, 1], [0.8, 0]),
        transform: [
            {
                scale: interpolate(pulse.value, [0, 1], [0, 2.2]),
            },
        ],
    }))
}

const useReportsGeoJson = (reports: Report[]) => {
    const { data: stations } = useStations()

    return useMemo(() => {
        if (isNil(stations)) return null

        const now = Date.now()

        return {
            type: 'FeatureCollection',
            features: reports.map((report) => {
                const { coordinates } = stations[report.stationId]

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [coordinates.longitude, coordinates.latitude],
                    },
                    properties: {
                        id: report.stationId,
                        opacity: report.isHistoric
                            ? 0.4
                            : 1.4 - Math.min((now - new Date(report.timestamp).getTime()) / (1000 * 60 * 60), 1),
                    },
                }
            }),
        }
    }, [reports, stations])
}

type ReportMarkerProps = {
    onPress: () => void
    report: Report
    animatedStyle: ReturnType<typeof usePulseAnimation> | null
}

const ReportMarker = ({ onPress, report, animatedStyle }: ReportMarkerProps) => {
    const { data: stations } = useStations()

    if (isNil(stations)) return null

    const shouldAnimate = Date.now() - report.timestamp.getTime() < 1000 * 60 * 30

    return (
        <MarkerView
            coordinate={[
                stations[report.stationId].coordinates.longitude,
                stations[report.stationId].coordinates.latitude,
            ]}
            key={report.stationId}
            allowOverlap
        >
            <Pressable style={styles.marker} onPress={onPress} hitSlop={10}>
                {shouldAnimate && <Animated.View style={[styles.pulse, animatedStyle]} />}
            </Pressable>
        </MarkerView>
    )
}

type ReportsLayerProps = {
    reports: Report[]
    onPressReport: (report: Report) => void
}

export const ReportsLayer = ({ reports, onPressReport }: ReportsLayerProps) => {
    const reportsGeoJson = useReportsGeoJson(reports)
    const pulseAnimatedStyle = usePulseAnimation()
    const showMarkers = useShowMarkersWithDelay()
    const shouldShowReports = useAppStore((state) => !state.appLocked)
    const { data: stations } = useStations()

    const theme = useTheme<Theme>()

    if (isNil(stations)) return null

    return (
        <>
            {showMarkers &&
                shouldShowReports &&
                reports.map((report) => (
                    <ReportMarker
                        key={report.stationId}
                        report={report}
                        onPress={() => onPressReport(report)}
                        animatedStyle={pulseAnimatedStyle}
                    />
                ))}
            <ShapeSource id="reports-source" shape={reportsGeoJson as GeoJSON.GeoJSON}>
                <CircleLayer
                    id="reports-layer"
                    style={{
                        circleRadius: 8,
                        circleColor: theme.colors.danger,
                        circleStrokeWidth: 3,
                        circleStrokeColor: theme.colors.whiteish,
                        circleOpacity: ['get', 'opacity'],
                        circleStrokeOpacity: ['get', 'opacity'],
                        visibility: shouldShowReports ? 'visible' : 'none',
                    }}
                />
            </ShapeSource>
        </>
    )
}
