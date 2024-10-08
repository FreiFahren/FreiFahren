import React, { useEffect, useState, useMemo, useRef } from 'react'
import { MarkerData } from 'src/utils/types'
import { stationDistanceMessage, elapsedTimeMessage } from '../../../utils/uiUtils'
import { getStationDistance, fetchNumberOfReports } from '../../../utils/dbUtils'
import { getNearestStation } from '../../../utils/mapUtils'
import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'
import Skeleton, { useSkeleton } from '../../Miscellaneous/LoadingPlaceholder/Skeleton'

import './MarkerModal.css'

interface MarkerModalProps {
    selectedMarker: MarkerData
    className: string
    userLat?: number
    userLng?: number
    children?: React.ReactNode
}

const MarkerModal: React.FC<MarkerModalProps> = ({ className, children, selectedMarker, userLat, userLng }) => {
    const { allStations } = useStationsAndLines()
    const { timestamp, station, line, direction } = selectedMarker

    const adjustedTimestamp = useMemo(() => {
        const tempTimestamp = new Date(timestamp)
        return tempTimestamp
    }, [timestamp])
    const currentTime = new Date().getTime()
    const elapsedTimeInMinutes = Math.floor((currentTime - adjustedTimestamp.getTime()) / 60000)
    const [numberOfReports, setNumberOfReports] = useState(0)

    const [isLoading, setIsLoading] = useState(false)
    const [stationDistance, setStationDistance] = useState<number | null>(null)
    const [shouldShowSkeleton, setShouldShowSkeleton] = useState(true)

    const prevStationId = useRef(station.id)

    const showSkeleton = useSkeleton({ isLoading: isLoading && shouldShowSkeleton })

    useEffect(() => {
        const fetchDistance = async () => {
            setIsLoading(true)
            const userStation = getNearestStation(allStations, userLat, userLng)
            if (userStation === null) return
            const distance = await getStationDistance(userStation.key, station.id)
            setStationDistance(distance)
            setIsLoading(false)
            // to avoid showing the skeleton when pos changes due to watchPosition
            setShouldShowSkeleton(false)
        }

        // only show skeleton if the station changes
        if (station.id !== prevStationId.current) {
            setShouldShowSkeleton(true)
            setStationDistance(null)
            prevStationId.current = station.id
        }

        fetchDistance()
        fetchNumberOfReports(station.id).then(setNumberOfReports)
    }, [userLat, userLng, station.id, allStations])

    return (
        <div className={`marker-modal info-popup modal ${className}`}>
            {children}
            <h1>{station.name}</h1>
            {(direction.name !== '' || line !== '') && (
                <h2>
                    <span className={`line-label ${line}`}>{line}</span> {direction.name}
                </h2>
            )}
            <div>
                <p>{elapsedTimeMessage(elapsedTimeInMinutes, selectedMarker.isHistoric)}</p>
                {numberOfReports > 0 && (
                    <p>
                        <strong>{numberOfReports} Mal</strong> diese Woche
                    </p>
                )}
                {userLat && userLng && (
                    <p className="distance">{showSkeleton ? <Skeleton /> : stationDistanceMessage(stationDistance)}</p>
                )}
                {selectedMarker.message && <p className="description">{selectedMarker.message}</p>}
            </div>
        </div>
    )
}

export default MarkerModal
