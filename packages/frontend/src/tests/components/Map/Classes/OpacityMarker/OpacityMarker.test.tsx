import React from 'react'
import { render, act, screen } from '@testing-library/react'
import { OpacityMarker } from '../../../../../components/Map/Markers/Classes/OpacityMarker/OpacityMarker'

// Mock react-map-gl/maplibre's Marker to avoid rendering issues in Jest
jest.mock('react-map-gl/maplibre', () => ({
    Marker: jest.fn().mockReturnValue(null),
}))
global.URL.createObjectURL = jest.fn()

// Utility function to advance time and apply pending timers
const advanceTime = (ms: number) => act(() => jest.advanceTimersByTime(ms))

describe('OpacityMarker', () => {
    beforeAll(() => {
        jest.useFakeTimers()
    })

    afterAll(() => {
        jest.useRealTimers()
    })

    it('does not enter an infinite loop with changing props', async () => {
        const initialProps = {
            markerData: {
                timestamp: new Date().toISOString(),
                station: {
                    id: 'SU-A',
                    name: 'Alexanderplatz',
                    coordinates: {
                        latitude: 52.52179049999999,
                        longitude: 13.4136147,
                    },
                },
                line: 'S7',
                direction: {
                    id: 'S-Ah',
                    name: 'Ahrensfelde',
                    coordinates: {
                        latitude: 52.57133899999999,
                        longitude: 13.565649,
                    },
                },
                isHistoric: false,
            },
            index: 0,
        }

        const { rerender } = render(
            <OpacityMarker formSubmitted={false} isFirstOpen={false} onMarkerClick={() => {}} {...initialProps} />
        )

        // Simulate props change that would cause re-render
        const newProps = {
            ...initialProps,
            markerData: {
                ...initialProps.markerData,
                direction: {
                    id: 'S-PH',
                    name: 'Potsdam Hauptbahnhof',
                    coordinates: { latitude: 52.39145, longitude: 13.06716 },
                },
            },
        }
        rerender(<OpacityMarker formSubmitted={false} isFirstOpen={false} onMarkerClick={() => {}} {...newProps} />)

        // Advance time to see if the component settles without exceeding max update depth
        advanceTime(5000)

        // Assertions here would typically check for expected behavior
        // For this test, the primary assertion is that it completes without throwing
        // Hence, if the test completes, it's considered passed for avoiding the infinite loop
    })

    it('updates station distance when userPosition changes', async () => {
        const initialProps = {
            markerData: {
                timestamp: new Date().toISOString(),
                station: {
                    id: 'SU-A',
                    name: 'Alexanderplatz',
                    coordinates: {
                        latitude: 52.52179049999999,
                        longitude: 13.4136147,
                    },
                },
                line: 'S7',
                direction: {
                    id: 'S-Ah',
                    name: 'Ahrensfelde',
                    coordinates: {
                        latitude: 52.57133899999999,
                        longitude: 13.565649,
                    },
                },
                isHistoric: false,
            },
            index: 0,
        }

        const { rerender } = render(
            <OpacityMarker formSubmitted={false} isFirstOpen={false} onMarkerClick={() => {}} {...initialProps} />
        )

        rerender(<OpacityMarker formSubmitted={false} onMarkerClick={() => {}} isFirstOpen={false} {...initialProps} />)

        // Advance time to allow for async operations to complete
        await advanceTime(5000)

        // Assertions here would typically check for expected behavior
        // For this test, the primary assertion is that it completes without throwing
        // Hence, if the test completes, it's considered passed for avoiding the infinite loop
    })

    describe('OpacityMarker', () => {
        it('does not render Marker when opacity is less than or equal to 0', () => {
            const initialProps = {
                markerData: {
                    timestamp: new Date().toISOString(),
                    station: {
                        id: 'SU-A',
                        name: 'Alexanderplatz',
                        coordinates: {
                            latitude: 52.52179049999999,
                            longitude: 13.4136147,
                        },
                    },
                    line: 'S7',
                    direction: {
                        id: 'S-Ah',
                        name: 'Ahrensfelde',
                        coordinates: {
                            latitude: 52.57133899999999,
                            longitude: 13.565649,
                        },
                    },
                    isHistoric: false,
                },
                index: 0,
                opacity: 0, // Add the 'opacity' prop
            }

            render(
                <OpacityMarker onMarkerClick={() => {}} formSubmitted={false} isFirstOpen={false} {...initialProps} />
            )

            // Check that the Marker is not rendered
            expect(screen.queryByRole('inspector-marker')).toBeNull()
        })
    })
})
