import 'maplibre-gl/dist/maplibre-gl.css'
import './Map.css'
import freifahrentheme from './freifahrentheme.json'

import React, { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { LngLatBoundsLike, LngLatLike, MapLayerMouseEvent, MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import type { StyleSpecification } from 'maplibre-gl'
import { useRiskData, useSegments, useStations } from 'src/api/queries'

import { useLocation } from '../../contexts/LocationContext'
import { sendAnalyticsEvent } from '../../hooks/useAnalytics'
import { convertStationsToGeoJSON } from '../../utils/mapUtils'
import { StationProperty } from '../../utils/types'
import { RegularLineLayer } from './MapLayers/LineLayer/RegularLineLayer'
import { RiskLineLayer } from './MapLayers/LineLayer/RiskLineLayer'
import { StationLayer } from './MapLayers/StationLayer/StationLayer'
import { LocationMarker } from './Markers/Classes/LocationMarker/LocationMarker'
import { MarkerContainer } from './Markers/MarkerContainer'

const Map = lazy(() => import('react-map-gl/maplibre'))

interface FreifahrenMapProps {
    isFirstOpen: boolean
    isRiskLayerOpen: boolean
    onRotationChange: (bearing: number) => void
    handleStationClick?: (station: StationProperty) => void
}
// Incase of using environment variables, we need to use the import.meta.env.VITE_MAP_CENTER_LNG and import.meta.env.VITE_MAP_CENTER_LAT
const cityViewPosition: { lng: number; lat: number } = {
    lng: Number.isNaN(Number(import.meta.env.VITE_MAP_CENTER_LNG))
        ? 13.388
        : Number(import.meta.env.VITE_MAP_CENTER_LNG),
    lat: Number.isNaN(Number(import.meta.env.VITE_MAP_CENTER_LAT))
        ? 52.5162
        : Number(import.meta.env.VITE_MAP_CENTER_LAT),
}
const GITHUB_ICON = `/icons/github.svg`
const INSTAGRAM_ICON = `/icons/instagram.svg`

const FreifahrenMap: React.FC<FreifahrenMapProps> = ({
    isFirstOpen,
    isRiskLayerOpen,
    onRotationChange,
    handleStationClick,
}) => {
    const SouthWestBounds: LngLatLike = {
        lng: Number.isNaN(Number(import.meta.env.VITE_MAP_BOUNDS_SW_LNG))
            ? 12.8364646484805
            : Number(import.meta.env.VITE_MAP_BOUNDS_SW_LNG),
        lat: Number.isNaN(Number(import.meta.env.VITE_MAP_BOUNDS_SW_LAT))
            ? 52.23115511676795
            : Number(import.meta.env.VITE_MAP_BOUNDS_SW_LAT),
    }
    const NorthEastBounds: LngLatLike = {
        lng: Number.isNaN(Number(import.meta.env.VITE_MAP_BOUNDS_NE_LNG))
            ? 14.00044556529124
            : Number(import.meta.env.VITE_MAP_BOUNDS_NE_LNG),
        lat: Number.isNaN(Number(import.meta.env.VITE_MAP_BOUNDS_NE_LAT))
            ? 52.77063424239867
            : Number(import.meta.env.VITE_MAP_BOUNDS_NE_LAT),
    }
    const maxBounds: LngLatBoundsLike = [SouthWestBounds, NorthEastBounds]

    const { data: lineSegments = null } = useSegments()

    const map = useRef<MapRef>(null)
    const clickTimer = useRef<number | null>(null)
    const { data: stations } = useStations()
    const stationGeoJSON = convertStationsToGeoJSON(stations ?? {})

    const { userPosition, initializeLocationTracking } = useLocation()

    useEffect(() => {
        if (!isFirstOpen) {
            initializeLocationTracking()
        }
    }, [isFirstOpen, initializeLocationTracking])

    const { data: segmentRiskData } = useRiskData()

    const handleRotate = useCallback(
        (event: ViewStateChangeEvent) => {
            onRotationChange(event.viewState.bearing)
        },
        [onRotationChange]
    )

    const onSingleClick = (event: MapLayerMouseEvent) => {
        const currentMap = map.current
        if (!currentMap) return

        const targetElement = event.originalEvent.target
        if (targetElement instanceof HTMLElement) {
            if (
                targetElement.classList.contains('inspector-marker') ||
                (targetElement.parentElement?.classList.contains('inspector-marker') ?? false)
            ) {
                return
            }
        }

        const features = currentMap.queryRenderedFeatures(event.point, {
            layers: ['stationLayer', 'stationNameLayer'],
        })

        if (features.length > 0 && handleStationClick) {
            const [feature] = features
            const { properties } = feature

            if (typeof properties.name === 'string' && feature.geometry.type === 'Point') {
                let parsedLines: unknown
                try {
                    parsedLines = JSON.parse(properties.lines ?? '[]')
                } catch (error) {
                    parsedLines = []
                }
                const lines =
                    Array.isArray(parsedLines) && parsedLines.every((item) => typeof item === 'string')
                        ? (parsedLines as string[])
                        : []

                const station: StationProperty = {
                    name: properties.name,
                    lines,
                    coordinates: {
                        longitude: (feature.geometry.coordinates as [number, number])[0],
                        latitude: (feature.geometry.coordinates as [number, number])[1],
                    },
                }

                handleStationClick(station)
                sendAnalyticsEvent('InfoModal opened', { meta: { source: 'map', station_name: station.name } })
            }
        }
    }

    const handleMapClick = useCallback(
        (event: MapLayerMouseEvent) => {
            if (clickTimer.current) {
                clearTimeout(clickTimer.current)
                clickTimer.current = null
            }
            clickTimer.current = window.setTimeout(() => {
                onSingleClick(event)
            }, 200)
        },
        [handleStationClick] // eslint-disable-line react-hooks/exhaustive-deps
    )

    const handleMapDoubleClick = useCallback(() => {
        if (clickTimer.current) {
            clearTimeout(clickTimer.current)
            clickTimer.current = null
        }
    }, [])

    return (
        <div id="map-container" data-testid="map-container">
            <Suspense fallback={<div>Loading...</div>}>
                <Map
                    reuseMaps
                    data-testid="map"
                    ref={map}
                    id="map"
                    initialViewState={{
                        longitude: cityViewPosition.lng,
                        latitude: cityViewPosition.lat,
                        zoom: 11,
                    }}
                    maxZoom={14}
                    minZoom={10}
                    maxBounds={maxBounds}
                    onRotate={handleRotate}
                    onClick={handleMapClick}
                    onDblClick={handleMapDoubleClick}
                    mapStyle={freifahrentheme as StyleSpecification}
                >
                    {!isFirstOpen ? <LocationMarker userPosition={userPosition} /> : null}
                    <MarkerContainer isFirstOpen={isFirstOpen} userPosition={userPosition} />
                    <StationLayer stations={stationGeoJSON} />
                    <RegularLineLayer lineSegments={lineSegments} isRiskLayerOpen={isRiskLayerOpen} />
                    {isRiskLayerOpen ? (
                        <RiskLineLayer preloadedRiskData={segmentRiskData} lineSegments={lineSegments} />
                    ) : null}
                </Map>
            </Suspense>
            <div className="fixed bottom-0 left-1.5 flex items-center gap-1 rounded px-1.5 py-0.5">
                <a href="https://github.com/FreiFahren/FreiFahren" target="_blank" rel="noopener noreferrer">
                    <img src={GITHUB_ICON} alt="GitHub" className="h-4 w-4 hover:underline" />
                </a>
                <a href="https://www.instagram.com/frei.fahren/" target="_blank" rel="noopener noreferrer">
                    <img src={INSTAGRAM_ICON} alt="Instagram" className="h-4 w-4 hover:underline" />
                </a>
            </div>
            <div
                className="fixed bottom-0 right-1.5 rounded px-1.5 py-0.5 text-gray-500 hover:underline"
                style={{ fontSize: 'var(--font-xxs)' }}
            >
                <a
                    href="https://openfreemap.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline hover:underline"
                >
                    OpenFreeMap
                </a>{' '}
                <a
                    href="https://www.openmaptiles.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline hover:underline"
                >
                    © OpenMapTiles
                </a>{' '}
                <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline hover:underline"
                >
                    Data from OpenStreetMap
                </a>
            </div>
        </div>
    )
}

export { FreifahrenMap }
