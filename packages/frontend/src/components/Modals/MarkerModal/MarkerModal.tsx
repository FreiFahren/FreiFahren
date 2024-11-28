import './MarkerModal.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sendAnalyticsEvent } from 'src/utils/analytics'
import { MarkerData } from 'src/utils/types'

import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'
import { useElapsedTimeMessage, useStationDistanceMessage } from '../../../hooks/Messages'
import { fetchNumberOfReports, getStationDistance } from '../../../utils/databaseUtils'
import { getNearestStation } from '../../../utils/mapUtils'
import { getLineColor } from '../../../utils/uiUtils'
import { Skeleton, useSkeleton } from '../../Miscellaneous/LoadingPlaceholder/Skeleton'

interface MarkerModalProps {
    selectedMarker: MarkerData
    className: string
    userLat?: number
    userLng?: number
    children?: React.ReactNode
}

export const MarkerModal = ({ className, children, selectedMarker, userLat, userLng }: MarkerModalProps) => {
    const { t } = useTranslation()

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

        // only show skeleton if the station changes
        if (station.id !== prevStationId.current) {
            setShouldShowSkeleton(true)
            setStationDistance(null)
            prevStationId.current = station.id
        }
        (async () => {
            setIsLoading(true)
            const userStation = getNearestStation(allStations, userLat, userLng)

            if (userStation === null) return
            const distance = await getStationDistance(userStation.key, station.id)

            setStationDistance(distance)
            setIsLoading(false)
            // to avoid showing the skeleton when pos changes due to watchPosition
            setShouldShowSkeleton(false)
        })().catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch station distance:', error)
        })

    }, [userLat, userLng, station.id, allStations])

    useEffect(() => {
        fetchNumberOfReports(station.id).then(setNumberOfReports).catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch number of reports:', error)
        })
    }, [station.id])

    const elapsedTimeMessage = useElapsedTimeMessage(elapsedTimeInMinutes, selectedMarker.isHistoric)
    const stationDistanceMessage = useStationDistanceMessage(stationDistance)

    const handleShare = useCallback(
        async (event: React.MouseEvent) => {
            event.preventDefault()
            try {
                let directionTextShare = direction.name
                let lineTextShare = line

                if (direction.name === '') {
                    directionTextShare = '?'
                }

                if (line === '') {
                    lineTextShare = '?'
                }

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (navigator.share !== undefined) {
                    await navigator.share({
                        title: t('Share.title'),
                        text: t('Share.text', {
                            station: station.name,
                            direction: directionTextShare,
                            line: lineTextShare,
                        }),
                        url: window.location.href,
                    })
                    sendAnalyticsEvent('Marker Shared', {
                        meta: {
                            station: station.name,
                            line,
                            direction: direction.name,
                        },
                    })
                } else {
                    await navigator.clipboard.writeText(window.location.href)
                    // eslint-disable-next-line no-alert
                    alert(t('Share.copied', 'Link copied to clipboard!'))
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error sharing:', error)
            }
        },
        [t, station, line, direction]
    )

    const disclaimerWithLink = useMemo(
        () => (
            <>
                {/* eslint-disable-next-line react/button-has-type */}
                <button onClick={handleShare} className="invite-link">
                    {t('MarkerModal.invite', 'Invite')}
                </button>{' '}
                {t('MarkerModal.inviteText', 'friends to improve accuracy.')}
            </>
        ),
        [t, handleShare]
    )

    const [disclaimerMessage, setDisclaimerMessage] = useState<string | JSX.Element>(
        t('MarkerModal.disclaimer', 'Data may be inaccurate.')
    )
    const [isDisclaimerVisible, setIsDisclaimerVisible] = useState(false)
    const TRANSITION_DURATION = 500 // Should match the transition-long duration in CSS

    useEffect(() => {
        setIsDisclaimerVisible(true)
        const timer = setTimeout(() => {
            setIsDisclaimerVisible(false)

            // Wait for fade out to complete before changing message
            setTimeout(() => {
                setDisclaimerMessage(disclaimerWithLink)
                setIsDisclaimerVisible(true)
            }, TRANSITION_DURATION)
        }, 2.5 * 1000)

        return () => clearTimeout(timer)
    }, [disclaimerWithLink])

    return (
        <div className={`marker-modal info-popup modal ${className}`}>
            {children}
            <h1>{station.name}</h1>
            {(direction.name !== '' || line !== '') && (
                <h2>
                    <span className="line-label" style={{ backgroundColor: getLineColor(line) }}>
                        {line}
                    </span>{' '}
                    {direction.name}
                </h2>
            )}
            <div>
                <p>{elapsedTimeMessage}</p>
                {numberOfReports > 0 && (
                    <p>
                        <strong>
                            {numberOfReports} {t('MarkerModal.reports')}
                        </strong>{' '}
                        {t('MarkerModal.thisWeek')}
                    </p>
                )}
                <div className="footer">
                    {userLat !== undefined && userLng !== undefined && (
                        <span className="distance">{showSkeleton ? <Skeleton /> : stationDistanceMessage}</span>
                    )}
                    <span className={`disclaimer ${isDisclaimerVisible ? 'visible' : ''}`}>{disclaimerMessage}</span>
                </div>
                {selectedMarker.message !== undefined && <p className="description">{selectedMarker.message}</p>}
            </div>
        </div>
    )
}
