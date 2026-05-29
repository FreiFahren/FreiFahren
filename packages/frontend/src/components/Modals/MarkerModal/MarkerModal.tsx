import './MarkerModal.css'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useStationDistance, useStationReports, useStations } from 'src/api/queries'
import { Report } from 'src/utils/types'

import { useElapsedTimeMessage, useStationDistanceMessage } from '../../../hooks/Messages'
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

    const { data: stations } = useStations()
    const { timestamp, stationId, lineId, directionId } = selectedMarker

    const stationName = stations?.[stationId]?.name ?? stationId
    const directionName = directionId !== null ? (stations?.[directionId]?.name ?? directionId) : null

    const { data: numberOfReports } = useStationReports(stationId)
    const {
        distance: stationDistance,
        isLoading,
        shouldShowSkeleton,
    } = useStationDistance(stationId, stations ?? {}, userLat, userLng)

    const showSkeleton = useSkeleton({ isLoading: isLoading && shouldShowSkeleton })
    const elapsedTimeMessage = useElapsedTimeMessage(timestamp, selectedMarker.isPredicted)
    const stationDistanceMessage = useStationDistanceMessage(stationDistance)

    return (
        <div className={`marker-modal info-popup modal ${className}`}>
            {children}
            <h1>{stationName}</h1>
            <div className="align-child-on-line direction-line">
                {lineId !== null ? <Line line={lineId} /> : null}
                {directionName !== null ? <h2>{directionName}</h2> : null}
            </div>
            <div>
                <p>{elapsedTimeMessage}</p>
                {numberOfReports !== undefined && numberOfReports > 0 ? (
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
            </div>
        </div>
    )
}

export { MarkerModal }
