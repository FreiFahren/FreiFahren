import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { StationList } from '../packages/navigation_service/src'

interface StationIdMapEntry {
    engineId: string
    coordinates: {
        lat: number
        lon: number
    }
}

interface StationIdMapOutput {
    matches: Record<string, StationIdMapEntry>
    unmatched: Record<
        string,
        {
            name: string
            coordinates: {
                latitude: number
                longitude: number
            }
        }
    >
}

function getStationTypePrefix(stationId: string): string {
    const [prefix] = stationId.split('-')

    if (prefix.includes('S') && prefix.includes('U')) {
        return 'S+U '
    } else if (prefix.includes('S')) {
        return 'S '
    } else if (prefix.includes('U')) {
        return 'U '
    }
    return ''
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * Creates a stations map based on the name of the station and the geocode API.
 * After this is created a human should validate the results and run post-process to create a production map.
 * @param stations - The stations list
 */
async function createStationsMap(stations: StationList): Promise<void> {
    const output: StationIdMapOutput = {
        matches: {},
        unmatched: {},
    }

    for (const [freifahrenId, station] of Object.entries(stations)) {
        try {
            const prefix = getStationTypePrefix(freifahrenId)
            const encodedName = encodeURIComponent(`${prefix}${station.name} (Berlin)`)

            const response = await fetch(`https://api.transitous.org/api/v1/geocode?text=${encodedName}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            // Filter stations by type and distance
            const matchingStations = data.filter((s: any) => {
                if (s.type !== 'STOP') return false

                const distance = calculateDistance(
                    station.coordinates.latitude,
                    station.coordinates.longitude,
                    s.lat,
                    s.lon
                )

                return distance <= 0.5 // 0.5km radius
            })

            if (matchingStations.length > 0) {
                const bestMatch = matchingStations[0]
                output.matches[freifahrenId] = {
                    engineId: bestMatch.id,
                    coordinates: {
                        lat: bestMatch.lat,
                        lon: bestMatch.lon,
                    },
                }
            } else {
                output.unmatched[freifahrenId] = {
                    name: station.name,
                    coordinates: station.coordinates,
                }
            }
        } catch (error) {
            output.unmatched[freifahrenId] = {
                name: station.name,
                coordinates: station.coordinates,
            }
            console.error(`Error processing station ${station.name} (${freifahrenId}):`, error)
        }
    }

    console.log(
        `For ${Object.keys(output.matches).length} stations we found a match out of ${Object.keys(stations).length} (${
            Object.keys(output.unmatched).length
        } unmatched)`
    )

    // Save to root directory
    const outputPath = join(__dirname, '../stationsMap.json')
    await writeFile(outputPath, JSON.stringify(output, null, 2))
    console.log(`Development version of stations map saved to ${outputPath}`)
}

/**
 * Post-processes the stations map to create a production version
 * Removes coordinates and simplifies the structure to just ID mappings
 */
async function postProcessStationsMap(): Promise<void> {
    try {
        // Read from root directory
        const inputPath = join(__dirname, '../stationsMap.json')
        console.log('Reading from:', inputPath)

        const fileContent = await readFile(inputPath, 'utf-8')
        const devMap = JSON.parse(fileContent) as {
            matched: Record<string, { engineId: string }>
        }

        // Create a simple map of freifahrenId -> engineId
        const productionMap: Record<string, string> = {}

        // Process matched stations
        for (const [freifahrenId, station] of Object.entries(devMap.matched)) {
            if ('engineId' in station && typeof station.engineId === 'string') {
                productionMap[freifahrenId] = station.engineId
            }
        }

        // Save to root directory
        const outputPath = join(__dirname, '../stationsMap.prod.json')
        await writeFile(outputPath, JSON.stringify(productionMap, null, 2))

        console.log(`Production version of stations map saved to ${outputPath}`)
        console.log(`Total mappings: ${Object.keys(productionMap).length}`)
    } catch (error) {
        console.error('Error post-processing stations map:', error)
        process.exit(1)
    }
}

/**
 * Goal of the script is to create a stations map of the freifahren stations to the engine stations.
 * It uses the name of the station and the geocode API to find the closest match.
 * After this is created a human should validate the results and run post-process to create a production map.
 */
async function main() {
    const command = process.argv[2]

    if (command === 'post-process') {
        await postProcessStationsMap()
    } else {
        try {
            const response = await fetch(`${process.env.BACKEND_URL}/v0/stations`)
            const stations = await response.json()
            await createStationsMap(stations)
        } catch (error) {
            console.error('Error:', error)
            process.exit(1)
        }
    }
}

main()
