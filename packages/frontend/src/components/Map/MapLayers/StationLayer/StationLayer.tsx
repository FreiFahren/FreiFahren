import React, { useEffect } from 'react'
import { Layer, MapRef, Source, useMap } from 'react-map-gl/maplibre'

import { StationGeoJSON, StationProperty } from '../../../../utils/types'
import { sendAnalyticsEvent } from '../../../../hooks/useAnalytics'

const UBAHN_ICON = `${process.env.PUBLIC_URL}/icons/ubahn.svg`
const SBAHN_ICON = `${process.env.PUBLIC_URL}/icons/sbahn.svg`

interface StationLayerProps {
    stations: StationGeoJSON
    onStationClick?: (station: StationProperty) => void
}
class IconFactory {
    constructor(private map: MapRef | undefined) {}

    createImage(name: string, source: string) {
        const image = new Image(12, 12)

        image.src = source
        image.onload = () => {
            if (!(this.map?.hasImage(name) ?? false)) {
                this.map?.addImage(name, image)
            }
        }
    }
}

const StationLayer: React.FC<StationLayerProps> = ({ stations, onStationClick }) => {
    const map = useMap()

    useEffect(() => {
        const currentMap = map.current
        const iconFactory = new IconFactory(currentMap)

        iconFactory.createImage('ubahn-icon', UBAHN_ICON)
        iconFactory.createImage('sbahn-icon', SBAHN_ICON)

        return () => {
            if (currentMap && currentMap.hasImage('ubahn-icon') && currentMap.hasImage('sbahn-icon')) {
                currentMap.removeImage('ubahn-icon')
                currentMap.removeImage('sbahn-icon')
            }
        }
    }, [map])

    useEffect(() => {
        if (!onStationClick || !map.current) return

        const handleClick = (e: maplibregl.MapMouseEvent) => {
            const features = map.current?.queryRenderedFeatures(e.point, {
                layers: ['stationLayer', 'stationNameLayer'],
            })

            if (features && features.length > 0) {
                const feature = features[0]
                const properties = feature.properties

                if (properties) {
                    const station: StationProperty = {
                        name: properties.name,
                        lines: JSON.parse(properties.lines || '[]'),
                        coordinates:
                            feature.geometry.type === 'Point'
                                ? {
                                      longitude: feature.geometry.coordinates[0],
                                      latitude: feature.geometry.coordinates[1],
                                  }
                                : { longitude: 0, latitude: 0 },
                    }

                    onStationClick(station)
                    sendAnalyticsEvent('InfoModal opened', { meta: { source: 'map', station_name: station.name } })
                }
            }
        }

        map.current.on('click', 'stationLayer', handleClick)
        map.current.on('click', 'stationNameLayer', handleClick)

        return () => {
            if (map.current) {
                map.current.off('click', 'stationLayer', handleClick)
                map.current.off('click', 'stationNameLayer', handleClick)
            }
        }
    }, [map, onStationClick])

    // priority is based on number of reports
    const firstPriorityStations = [
        'Hauptbahnhof',
        'Gesundbrunnen',
        'Jungfernheide',
        'Ostkreuz',
        'Südkreuz',
        'Westkreuz',
        'Potsdamer Platz',
        'Friedrichstraße',
        'Zoologischer Garten',
        'Warschauer Straße',
        'Alexanderplatz',
        'Kottbusser Tor',
        'Hermannplatz',
        'Neukölln',
        'Tempelhof',
        'Hermannstraße',
    ]
    const secondPriorityStations = [
        'Osloer Straße',
        'Frankfurter Allee',
        'Leopoldplatz',
        'Weinmeisterstraße',
        'Moritzplatz',
        'Hallesches Tor',
        'Rathaus Steglitz',
        'Gleisdreieck',
        'Prenzlauer Allee',
        'Mehringdamm',
        'Hansaplatz',
        'Bernauerstraße',
        'Landsberger Allee',
        'Schönleinstraße',
        'Voltastraße',
        'WWittenbergplatz',
        'Schönhauser Allee',
        'Jannowitz Brücke',
        'Bellevue',
        'Schlesisches Tor',
        'Nollendorfplatz',
        'Westend',
        'Schöneberg',
    ]

    return (
        <Source id="stationSource" type="geojson" data={stations}>
            <Layer
                id="stationLayer"
                type="circle"
                paint={{
                    'circle-radius': 2,
                    'circle-color': '#ffffff',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#000000',
                }}
            />
            <Layer
                id="stationNameLayer"
                type="symbol"
                layout={{
                    'text-field': ['get', 'name'],
                    'text-size': 12,
                    'text-allow-overlap': true,
                    'icon-image': [
                        'case',
                        [
                            'any',
                            ['in', 'S1', ['get', 'lines']],
                            ['in', 'S2', ['get', 'lines']],
                            ['in', 'S3', ['get', 'lines']],
                            ['in', 'S5', ['get', 'lines']],
                            ['in', 'S7', ['get', 'lines']],
                            ['in', 'S8', ['get', 'lines']],
                            ['in', 'S9', ['get', 'lines']],
                            ['in', 'S25', ['get', 'lines']],
                            ['in', 'S26', ['get', 'lines']],
                            ['in', 'S41', ['get', 'lines']],
                            ['in', 'S42', ['get', 'lines']],
                            ['in', 'S45', ['get', 'lines']],
                            ['in', 'S46', ['get', 'lines']],
                            ['in', 'S47', ['get', 'lines']],
                            ['in', 'S85', ['get', 'lines']],
                        ],
                        'sbahn-icon',
                        [
                            'any',
                            ['in', 'U1', ['get', 'lines']],
                            ['in', 'U2', ['get', 'lines']],
                            ['in', 'U3', ['get', 'lines']],
                            ['in', 'U4', ['get', 'lines']],
                            ['in', 'U5', ['get', 'lines']],
                            ['in', 'U6', ['get', 'lines']],
                            ['in', 'U7', ['get', 'lines']],
                            ['in', 'U8', ['get', 'lines']],
                            ['in', 'U9', ['get', 'lines']],
                        ],
                        'ubahn-icon',

                        'sbahn_icon',
                    ],
                    'icon-anchor': 'bottom',
                    'text-offset': [0, 1],
                }}
                paint={{
                    'text-color': '#fff',
                    'text-halo-color': 'black',
                    'text-halo-width': 0.2,
                    'text-opacity': [
                        'step',
                        ['zoom'],
                        ['case', ['in', ['get', 'name'], ['literal', firstPriorityStations]], 1, 0],
                        11,
                        ['case', ['in', ['get', 'name'], ['literal', firstPriorityStations]], 1, 0],
                        11.5,
                        [
                            'case',
                            [
                                'any',
                                ['in', ['get', 'name'], ['literal', firstPriorityStations]],
                                ['in', ['get', 'name'], ['literal', secondPriorityStations]],
                            ],
                            1,
                            0,
                        ],
                        13,
                        1,
                        14,
                        1,
                    ],
                    'icon-opacity': [
                        'step',
                        ['zoom'],
                        ['case', ['in', ['get', 'name'], ['literal', firstPriorityStations]], 1, 0],
                        12,
                        [
                            'case',
                            [
                                'any',
                                ['in', ['get', 'name'], ['literal', firstPriorityStations]],
                                ['in', ['get', 'name'], ['literal', secondPriorityStations]],
                            ],
                            1,
                            0,
                        ],
                        13,
                        1,
                        15,
                        0,
                    ],
                }}
            />
        </Source>
    )
}

export { StationLayer }
