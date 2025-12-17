import { CircleLayer, ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native'
import { useTheme } from '@shopify/restyle'
import DeviceInfo from 'react-native-device-info'

import { useStations } from '../../api/queries'
import { Theme } from '../../theme'
import { useTracking } from '../../tracking/provider'
import { filterNullish } from '../../utils'

const useStationsAsGeoJSON = () => {
    const { data: stations } = useStations()
    const { track } = useTracking()

    if (!stations) return null

    return {
        type: 'FeatureCollection',
        features: Object.keys(stations)
            .map((key) => {
                const station = stations[key]

                if (station === undefined) {
                    track({
                        name: 'Missing Station',
                        stationId: key,
                        version: DeviceInfo.getVersion(),
                        location: 'useStationsAsGeoJSON',
                        exampleKnownStationId: Object.keys(stations)[0],
                    })

                    return null
                }

                return {
                    type: 'Feature',
                    properties: {
                        name: station.name,
                        lines: station.lines,
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [station.coordinates.longitude, station.coordinates.latitude],
                    },
                }
            })
            .filter(filterNullish),
    }
}

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

export const StationLayer = () => {
    const stationsGeoJSON = useStationsAsGeoJSON()
    const theme = useTheme<Theme>()

    if (!stationsGeoJSON) return null

    return (
        <ShapeSource id="stationSource" shape={stationsGeoJSON as GeoJSON.FeatureCollection}>
            <CircleLayer
                id="stationLayer"
                style={{
                    circleRadius: 2,
                    circleColor: '#ffffff',
                    circleStrokeWidth: 1,
                    circleStrokeColor: '#000000',
                }}
            />
            <SymbolLayer
                id="stationNameLayer"
                style={{
                    textField: ['get', 'name'],
                    textColor: theme.colors.fg,
                    textAnchor: 'bottom',
                    textSize: 12,
                    textOffset: [0, -0.8],
                    textHaloColor: '#000000',
                    textHaloWidth: 1,
                    textOpacity: [
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
                }}
            />
        </ShapeSource>
    )
}
