import { CircleLayer, ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native'

import { useStations } from '../../api/queries'
import { theme } from '../../theme'

const useStationsAsGeoJSON = () => {
    const { data: stations } = useStations()

    if (!stations) return null

    return {
        type: 'FeatureCollection',
        features: Object.keys(stations).map((key) => ({
            type: 'Feature',
            properties: {
                name: stations[key].name,
                lines: stations[key].lines,
            },
            geometry: {
                type: 'Point',
                coordinates: [stations[key].coordinates.longitude, stations[key].coordinates.latitude],
            },
        })),
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

    if (!stationsGeoJSON) return null

    return (
        <ShapeSource id="stationSource" shape={stationsGeoJSON as GeoJSON.GeoJSON}>
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
                    textColor: theme.colors.text[100],
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
