import React from 'react'
import { useTranslation } from 'react-i18next'

import { Report } from 'src/utils/types'
import { useElapsedTimeMessage, useStationDistanceMessage } from '../../../hooks/Messages'
import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'
import Skeleton, { useSkeleton } from '../../Miscellaneous/LoadingPlaceholder/Skeleton'
import { useStationReports } from '../../../hooks/useStationReports'
import { useStationDistance } from '../../../hooks/useStationDistance'

import ShareButton from '../../Miscellaneous/ShareButton/ShareButton'
import Line from '../../Miscellaneous/Line/Line'

import './MarkerModal.css'

interface MarkerModalProps {
    selectedMarker: Report
    className: string
    userLat?: number
    userLng?: number
    children?: React.ReactNode
}

const MarkerModal: React.FC<MarkerModalProps> = ({ className, children, selectedMarker, userLat, userLng }) => {
    const { t } = useTranslation()

    const { allStations } = useStationsAndLines()
    const { timestamp, station, line, direction } = selectedMarker


    const numberOfReports = useStationReports(station.id)
    const {
        distance: stationDistance,
        isLoading,
        shouldShowSkeleton,
    } = useStationDistance(station.id, allStations, userLat, userLng)

    const showSkeleton = useSkeleton({ isLoading: isLoading && shouldShowSkeleton })
    const elapsedTimeMessage = useElapsedTimeMessage(timestamp, selectedMarker.isHistoric)
    const stationDistanceMessage = useStationDistanceMessage(stationDistance)

    return (
        <div className={`marker-modal info-popup modal ${className}`}>
            {children}
            <h1>{station.name}</h1>
            <div className="align-child-on-line direction-line">
                {line && <Line line={line} />}
                {direction?.name && <h2>{direction?.name}</h2>}
            </div>
            <div>
                <p>{elapsedTimeMessage}</p>
                {numberOfReports > 0 && (
                    <p className="reports-count">
                        <b>
                            {numberOfReports} {t('MarkerModal.reports')}
                        </b>{' '}
                        {t('MarkerModal.thisWeek')}
                    </p>
                )}
                <div className="footer">
                    {userLat && userLng && (
                        <span className="distance">{showSkeleton ? <Skeleton /> : stationDistanceMessage}</span>
                    )}
                    <span className="disclaimer">{t('MarkerModal.inviteText')}</span>
                </div>
                {selectedMarker.message && <p className="description">{selectedMarker.message}</p>}
                <ShareButton report={selectedMarker} />
            </div>
        </div>
    )
}

export default MarkerModal
