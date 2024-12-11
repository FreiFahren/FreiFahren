import { useTranslation } from 'react-i18next'

export const useStationDistanceMessage = (stationDistance: number | null): JSX.Element | null => {
    const { t } = useTranslation()

    if (stationDistance === null) return null
    return (
        <>
            {stationDistance <= 1 ? (
                t('MarkerModal.oneStation')
            ) : (
                <>
                    {stationDistance} {t('MarkerModal.stations')}{' '}
                </>
            )}
            {t('MarkerModal.fromYou')}
        </>
    )
}

/**
 * Generates a JSX Element displaying a human-readable message about elapsed time.
 *
 * @param {number | undefined} elapsedTimeInMinutes - The elapsed time in minutes.
 * @param {boolean} isHistoric - Whether the report is historic.
 * @returns {JSX.Element | null} A span element containing the formatted time message, or null if elapsedTimeInMinutes is undefined.
 *
 * The function handles three cases:
 * 1. If the elapsed time is more than 60 minutes, it displays the time in hours.
 * 2. If the elapsed time is 1 minute or less, it displays "Jetzt".
 * 3. For any other duration, it displays the time in minutes.
 */
export const useElapsedTimeMessage = (
    elapsedTimeInMinutes: number | undefined,
    isHistoric: boolean
): JSX.Element | null => {
    const { t, i18n } = useTranslation()
    const currentLanguage = i18n.language

    if (elapsedTimeInMinutes === undefined) {
        return null
    }

    if (isHistoric || (elapsedTimeInMinutes > 45 && elapsedTimeInMinutes < 60)) {
        return <span className="elapsed-time">{t('MarkerModal.moreThan45Min')}</span>
    }
    if (Math.floor(elapsedTimeInMinutes / 60) === 1) {
        return (
            <span className="elapsed-time">
                {t('MarkerModal.oneHourAgo')} <strong>{t('MarkerModal.oneHour')}</strong>
            </span>
        )
    }
    if (elapsedTimeInMinutes > 60) {
        return (
            <span className="elapsed-time">
                {currentLanguage === 'de' ? t('MarkerModal.ago') + ' ' : ''}
                {Math.floor(elapsedTimeInMinutes / 60)} {t('MarkerModal.hours')}
                {currentLanguage === 'en' ? ' ' + t('MarkerModal.ago') : ''}
            </span>
        )
    }
    if (elapsedTimeInMinutes <= 1) {
        return <span className="elapsed-time">{t('MarkerModal.now')}</span>
    }
    return (
        <span className="elapsed-time">
            {currentLanguage === 'de' ? t('MarkerModal.ago') + ' ' : ''}
            {elapsedTimeInMinutes} {t('MarkerModal.minutes')}
            {currentLanguage === 'en' ? ' ' + t('MarkerModal.ago') : ''}
        </span>
    )
}
