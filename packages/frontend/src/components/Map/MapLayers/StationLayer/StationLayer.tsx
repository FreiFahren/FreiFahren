import { useEffect } from 'react'
import { Layer, MapRef, Source, useMap } from 'react-map-gl/maplibre'

import { StationGeoJSON } from '../../../../utils/types'

const ubahnIcon = `${process.env.PUBLIC_URL}/icons/ubahn.svg`
const sbahnIcon = `${process.env.PUBLIC_URL}/icons/sbahn.svg`

interface StationLayerProps {
    stations: StationGeoJSON
    textColor: string
}
class IconFactory {
    constructor(private map: MapRef | undefined) { }

    createImage(name: string, source: string) {
        const image = new Image(12, 12)

        image.src = source
        image.onload = () => {
            if (this.map?.hasImage(name) !== true) {
                this.map?.addImage(name, image)
            }
        }
    }
}

export const StationLayer = ({ stations, textColor }: StationLayerProps) => {
    const map = useMap()

    useEffect(() => {
        const currentMap = map.current
        const iconFactory = new IconFactory(currentMap)

        iconFactory.createImage('ubahn-icon', ubahnIcon)
        iconFactory.createImage('sbahn-icon', sbahnIcon)

        return () => {
            if (currentMap?.hasImage('ubahn-icon') === true && currentMap.hasImage('sbahn-icon')) {
                currentMap.removeImage('ubahn-icon')
                currentMap.removeImage('sbahn-icon')
            }
        }
    }, [map])

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
                    'text-color': textColor,
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
