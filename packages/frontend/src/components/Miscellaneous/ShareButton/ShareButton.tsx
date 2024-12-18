import './ShareButton.css'

import i18next from 'i18next'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'
import { Report } from 'src/utils/types'

interface ShareButtonProps {
    report?: Report
}

const ShareButton: React.FC<ShareButtonProps> = ({ report }) => {
    const { t } = useTranslation()

    const handleShare = useCallback(
        async (event: React.MouseEvent) => {
            event.preventDefault()

            const formatTime = (timestamp: string, isHistoric: boolean): string => {
                const date = new Date(timestamp)

                if (isHistoric) {
                    return date.toLocaleString(i18next.language === 'de' ? 'de-DE' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })
                }

                const now = new Date()
                const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

                if (diffInMinutes < 1) {
                    return t('MarkerModal.now')
                }

                if (diffInMinutes < 60) {
                    return `${diffInMinutes} ${t('MarkerModal.minutes')} ${t('MarkerModal.ago')}`
                }

                if (diffInMinutes < 1440) {
                    const hours = Math.floor(diffInMinutes / 60)
                    if (hours === 1) {
                        return t('MarkerModal.oneHourAgo')
                    }
                    return `${hours} ${t('MarkerModal.hours')} ${t('MarkerModal.ago')}`
                }

                return date.toLocaleString(i18next.language === 'de' ? 'de-DE' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                })
            }

            try {
                if (!report) {
                    await navigator.share({
                        title: t('Share.title'),
                        url: window.location.href,
                    })
                    await sendAnalyticsEvent('Page Shared', {})
                    return
                }

                const shareText = t('Share.text', {
                    station: report.station.name,
                    direction: report.direction?.name ?? '?',
                    line: report.line ?? '?',
                    time: formatTime(report.timestamp, report.isHistoric),
                })

                await navigator.share({
                    title: t('Share.title'),
                    text: shareText,
                    url: window.location.href,
                })
                await sendAnalyticsEvent('Marker Shared', {
                    meta: {
                        station: report.station.name,
                        line: report.line,
                        direction: report.direction?.name,
                    },
                })
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error sharing:', error)
            }
        },
        [t, report]
    )

    return (
        <button onClick={handleShare} className="share-button" type="button">
            <img src={`${process.env.PUBLIC_URL}/icons/share-svgrepo-com.svg`} alt="Share" />
            <span>{t('Share.button')}</span>
        </button>
    )
}

export default ShareButton
