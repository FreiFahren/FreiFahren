import './MarkerModal.css'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Report } from 'src/utils/types'

import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'
import { useElapsedTimeMessage, useStationDistanceMessage } from '../../../hooks/Messages'
import { useStationDistance } from '../../../hooks/useStationDistance'
import { useStationReports } from '../../../hooks/useStationReports'
import Line from '../../Miscellaneous/Line/Line'
import Skeleton, { useSkeleton } from '../../Miscellaneous/LoadingPlaceholder/Skeleton'
import ShareButton from '../../Miscellaneous/ShareButton/ShareButton'

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
                {line !== null && line !== '' ? <Line line={line} /> : null}
                {direction && direction.name ? <h2>{direction.name}</h2> : null}
            </div>
            <div>
                <p>{elapsedTimeMessage}</p>
                {typeof numberOfReports === 'number' && numberOfReports > 0 ? (
                    <p className="reports-count">
                        <b>
                            {numberOfReports} {t('MarkerModal.reports')}
                        </b>{' '}
                        {t('MarkerModal.thisWeek')}
                    </p>
                ) : null}
                <div className="footer">
                    {typeof userLat === 'number' &&
                    !Number.isNaN(userLat) &&
                    typeof userLng === 'number' &&
                    !Number.isNaN(userLng) ? (
                        <span className="distance">{showSkeleton ? <Skeleton /> : stationDistanceMessage}</span>
                    ) : null}
                    <span className="disclaimer">{t('MarkerModal.inviteText')}</span>
                </div>
                {selectedMarker.message !== null &&
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                selectedMarker.message !== undefined &&
                selectedMarker.message !== '' ? (
                    <p className="description">{selectedMarker.message}</p>
                ) : null}
                <ShareButton report={selectedMarker} />
            </div>
        </div>
    )
}

export default MarkerModal
