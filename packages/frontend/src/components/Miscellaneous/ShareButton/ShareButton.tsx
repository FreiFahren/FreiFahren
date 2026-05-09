/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import './ShareButton.css'

import i18next, { TFunction } from 'i18next'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLines, useStations } from 'src/api/queries'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'
import { Report } from 'src/utils/types'

interface ShareButtonProps {
    report?: Report
}

const formatTime = (timestamp: string, isPredicted: boolean, t: TFunction): string => {
    const date = new Date(timestamp)

    // For predicted reports, show the full date and time
    if (isPredicted) {
        return date.toLocaleString(i18next.language === 'de' ? 'de-DE' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    // For recent reports, show relative time
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
        return t('MarkerModal.now')
    }

    if (diffInMinutes < 60) {
        return `${diffInMinutes} ${t('MarkerModal.minutes')} ${t('MarkerModal.ago')}`
    }

    if (diffInMinutes < 1440) {
        // less than 24 hours
        const hours = Math.floor(diffInMinutes / 60)

        if (hours === 1) {
            return t('MarkerModal.oneHourAgo')
        }
        return `${hours} ${t('MarkerModal.hours')} ${t('MarkerModal.ago')}`
    }

    // If more than 24 hours, show the date and time
    return date.toLocaleString(i18next.language === 'de' ? 'de-DE' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

const ShareButton: React.FC<ShareButtonProps> = ({ report }) => {
    const { t } = useTranslation()
    const { data: stations } = useStations()
    const { data: lines } = useLines()

    const handleShare = useCallback(
        async (event: React.MouseEvent) => {
            event.preventDefault()
            try {
                if (!report) {
                    // Just share the page URL if no report
                    try {
                        await navigator.share({
                            title: t('Share.title'),
                            url: window.location.href,
                        })
                        await sendAnalyticsEvent('Page Shared', {})
                    } catch (error) {
                        // eslint-disable-next-line no-console
                        console.error('Error sharing:', error)
                    }
                    return
                }

                const stationName = stations?.[report.stationId]?.name ?? report.stationId
                const directionName =
                    report.directionId !== null ? (stations?.[report.directionId]?.name ?? report.directionId) : '?'
                const lineName =
                    report.lineId !== null
                        ? (lines?.find((line) => line.id === report.lineId)?.name ?? report.lineId)
                        : '?'

                const shareText = t('Share.text', {
                    station: stationName,
                    direction: directionName,
                    line: lineName,
                    time: formatTime(report.timestamp, report.isPredicted, t),
                })

                // The error seems incorrect in this case - the navigator.share check is actually necessary because it's not available in all browsers.
                // eslint-disable-next-line, @typescript-eslint/strict-boolean-expressions
                if (navigator.share) {
                    await navigator.share({
                        title: t('Share.title'),
                        text: shareText,
                        url: window.location.href,
                    })
                    await sendAnalyticsEvent('Marker Shared', {
                        meta: {
                            stationId: report.stationId,
                            lineId: report.lineId,
                            directionId: report.directionId,
                        },
                    })
                } else {
                    await navigator.clipboard.writeText(`${shareText} ${window.location.href}`)
                    // eslint-disable-next-line no-alert
                    alert(t('Share.copied'))
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error sharing:', error)
            }
        },
        [t, report, stations, lines]
    )

    return (
        <button onClick={handleShare} className="share-button h-10 w-full rounded-md p-2" type="button">
            <img src="/icons/share-svgrepo-com.svg" alt="Share" />
            <span>{t('Share.button')}</span>
        </button>
    )
}

export { ShareButton }
