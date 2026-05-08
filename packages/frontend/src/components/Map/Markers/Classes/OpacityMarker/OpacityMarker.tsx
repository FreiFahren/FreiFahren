import './OpacityMarker.css'

import maplibregl from 'maplibre-gl'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker } from 'react-map-gl/maplibre'
import { useStations } from 'src/api/queries'
import { useViewedReports } from 'src/contexts/ViewedReportsContext'
import { Report } from 'src/utils/types'

interface OpacityMarkerProps {
    markerData: Report
    index: number
    isFirstOpen: boolean
    onMarkerClick: (markerData: Report) => void
}

export const OpacityMarker: React.FC<OpacityMarkerProps> = ({ markerData, index, isFirstOpen, onMarkerClick }) => {
    const [opacity, setOpacity] = useState(0)
    const { timestamp, stationId, lineId, isPredicted } = markerData
    const { data: stations } = useStations()
    const station = stations?.[stationId]
    const { setLastViewed, isRecentAndUnviewed } = useViewedReports()

    const adjustedTimestamp = useMemo(() => {
        const tempTimestamp = new Date(timestamp)

        return new Date(tempTimestamp)
    }, [timestamp])

    const markerRef = useRef<maplibregl.Marker>(null)

    // fix later, we don't need a return
    // eslint-disable-next-line consistent-return
    useEffect(() => {
        let intervalId: number

        if (!isFirstOpen) {
            if (!isPredicted) {
                const calculateOpacity = () => {
                    const currentTime = new Date().getTime()
                    const elapsedTime = currentTime - adjustedTimestamp.getTime()
                    const timeToFade = 60 * 60 * 1000
                    let newOpacity = Math.max(0, 1 - elapsedTime / timeToFade)

                    // When the opacity is too low the marker is not visible
                    if (newOpacity <= 0.2) {
                        newOpacity = 0.2
                    }
                    setOpacity(newOpacity)
                    markerRef.current?.setOpacity(newOpacity.toString())

                    if (elapsedTime >= timeToFade) {
                        setOpacity(0)
                        clearInterval(intervalId)
                    }
                }

                calculateOpacity() // Initial calculation
                intervalId = setInterval(calculateOpacity, 30 * 1000) // Avoid excessive calculations
            } else {
                const historicOpacity = 0.5
                markerRef.current?.setOpacity(historicOpacity.toString())
                setOpacity(historicOpacity)
            }
            return () => clearInterval(intervalId)
        }
    }, [adjustedTimestamp, isPredicted, isFirstOpen, stationId, opacity])

    if (opacity <= 0 || !station) {
        return null
    }

    const handleMarkerClick = () => {
        onMarkerClick(markerData)
        setLastViewed(markerData)
    }

    const shouldPulse = isRecentAndUnviewed(markerData)

    return (
        <Marker
            key={`${lineId}-${index}`}
            ref={markerRef}
            className="inspector-marker"
            latitude={station.coordinates.latitude}
            longitude={station.coordinates.longitude}
            opacity={opacity.toString()}
            onClick={handleMarkerClick}
        >
            <span className={`marker live ${shouldPulse ? 'pulse' : ''}`} />
        </Marker>
    )
}
