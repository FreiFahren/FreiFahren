import './MarkerModal.css'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Report } from 'src/utils/types'

import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'
import { useElapsedTimeMessage, useStationDistanceMessage } from '../../../hooks/Messages'
import { useStationDistance } from '../../../hooks/useStationDistance'
import { useStationReports } from '../../../hooks/useStationReports'
import { Line } from '../../Miscellaneous/Line/Line'
import { Skeleton, useSkeleton } from '../../Miscellaneous/LoadingPlaceholder/Skeleton'

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
    const { timestamp, station, line, direction, message } = selectedMarker

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
                {line !== null ? <Line line={line} /> : null}
                {direction?.name !== undefined ? <h2>{direction.name}</h2> : null}
            </div>
            <div>
                <p>{elapsedTimeMessage}</p>
                {numberOfReports > 0 ? (
                    <p className="reports-count">
                        <b>
                            {numberOfReports} {t('MarkerModal.reports')}
                        </b>{' '}
                        {t('MarkerModal.thisWeek')}
                    </p>
                ) : null}
                <div className="footer">
                    {userLat !== undefined && userLng !== undefined ? (
                        <span className="distance">{showSkeleton ? <Skeleton /> : stationDistanceMessage}</span>
                    ) : null}
                    <span className="disclaimer">{t('MarkerModal.inviteText')}</span>
                </div>
                <span className="disclaimer">{t('MarkerModal.syncText')}</span>
                {message !== null && message !== '' ? <p className="description">{message}</p> : null}
            </div>
        </div>
    )
}

export { MarkerModal }
