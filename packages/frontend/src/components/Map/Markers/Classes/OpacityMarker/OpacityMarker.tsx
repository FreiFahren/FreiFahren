import './OpacityMarker.css'

import maplibregl from 'maplibre-gl'
import React, { useEffect, useMemo, useRef,useState } from 'react'
import { Marker } from 'react-map-gl/maplibre'
import { useViewedReports } from 'src/contexts/ViewedReportsContext'
import { Report } from 'src/utils/types'

interface OpacityMarkerProps {
    markerData: Report
    index: number
    isFirstOpen: boolean
    formSubmitted: boolean
    onMarkerClick: (markerData: Report) => void
}

export const OpacityMarker: React.FC<OpacityMarkerProps> = ({
    markerData,
    index,
    isFirstOpen,
    formSubmitted,
    onMarkerClick,
}) => {
    const [opacity, setOpacity] = useState(0)
    const { timestamp, station, line, isHistoric } = markerData
    const { setLastViewed, isRecentAndUnviewed } = useViewedReports()

    const adjustedTimestamp = useMemo(() => {
        const tempTimestamp = new Date(timestamp)

        return new Date(tempTimestamp)
    }, [timestamp])

    const markerRef = useRef<maplibregl.Marker>(null)

    // fix later, we don't need a return
    // eslint-disable-next-line consistent-return
    useEffect(() => {
        let intervalId: NodeJS.Timeout

        if (!isFirstOpen) {
            if (!isHistoric) {
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

                    if (elapsedTime >= timeToFade) {
                        setOpacity(0)
                        clearInterval(intervalId)
                    }
                }

                // change the direct reference of the marker
                markerRef.current?.setOpacity(opacity.toString())

                calculateOpacity() // Initial calculation
                intervalId = setInterval(calculateOpacity, 30 * 1000) // Avoid excessive calculations
            } else {
                markerRef.current?.setOpacity('0.5')
                setOpacity(0.5)
            }
            return () => clearInterval(intervalId)
        }
    }, [adjustedTimestamp, isHistoric, isFirstOpen, opacity, station.name, formSubmitted])

    if (opacity <= 0) {
        return null
    }

    const handleMarkerClick = () => {
        onMarkerClick(markerData)
        setLastViewed(markerData)
    }

    const shouldPulse = isRecentAndUnviewed(markerData)

    return (
        <Marker
            key={`${line}-${index}`}
            ref={markerRef}
            className="inspector-marker"
            latitude={station.coordinates.latitude}
            longitude={station.coordinates.longitude}
            style={{ opacity: opacity.toString() }}
            onClick={handleMarkerClick}
        >
            <span className={`marker live ${shouldPulse ? 'pulse' : ''}`} />
        </Marker>
    )
}
