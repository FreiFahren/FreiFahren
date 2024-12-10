import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { sendAnalyticsEvent } from 'src/utils/analytics'
import { Report } from 'src/utils/types'

interface ShareButtonProps {
    report?: Report
}

const ShareButton: React.FC<ShareButtonProps> = ({ report }) => {
    const { t } = useTranslation()

    const handleShare = useCallback(
        async (e: React.MouseEvent) => {
            e.preventDefault()

            try {
                if (!report) {
                    // Just share the page URL if no report
                    if (navigator.share) {
                        await navigator.share({
                            title: t('Share.title'),
                            url: window.location.href,
                        })
                        await sendAnalyticsEvent('Page Shared', {})
                    } else {
                        await navigator.clipboard.writeText(window.location.href)
                        alert(t('Share.copied'))
                    }
                    return
                }

                const shareText = t('Share.text', {
                    station: report.station.name,
                    direction: report.direction?.name || '?',
                    line: report.line || '?',
                })

                if (navigator.share) {
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
                } else {
                    await navigator.clipboard.writeText(`${shareText} ${window.location.href}`)
                    alert(t('Share.copied'))
                }
            } catch (error) {
                console.error('Error sharing:', error)
            }
        },
        [t, report]
    )

    return (
        <button onClick={handleShare} className="share-button">
            <img src={process.env.PUBLIC_URL + '/icons/share-svgrepo-com.svg'} alt="Share" />
            <span>{t('Share.button')}</span>
        </button>
    )
}

export default ShareButton
