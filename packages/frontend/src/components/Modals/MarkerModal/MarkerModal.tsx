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
import { ShareButton } from '../../Miscellaneous/ShareButton/ShareButton'

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

                
                {/*  because no line should be shown
                eslint-disable-next-line react/jsx-no-leaked-render */}
                {/* eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, react/jsx-no-leaked-render */}
                {line && <Line line={line} />}
                {direction?.name !== undefined ? <h2>{direction.name}</h2> : null}
            </div>
            <div>
                <p>{elapsedTimeMessage}</p>
                {numberOfReports > 0 ? <p className="reports-count">
                        <b>
                            {numberOfReports} {t('MarkerModal.reports')}
                        </b>{' '}
                        {t('MarkerModal.thisWeek')}
                    </p> : null}
                <div className="footer">
                    {userLat !== undefined && userLng !== undefined ? <span className="distance">{showSkeleton ? <Skeleton /> : stationDistanceMessage}</span> : null}
                    <span className="disclaimer">{t('MarkerModal.inviteText')}</span>
                </div>
                {selectedMarker.message !== null ? <p className="description">{selectedMarker.message}</p> : null}
                <ShareButton report={selectedMarker} />
            </div>
        </div>
    )
}

export { MarkerModal }
