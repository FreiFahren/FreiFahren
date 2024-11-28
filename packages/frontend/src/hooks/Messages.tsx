import { useTranslation } from 'react-i18next'

export const useStationDistanceMessage = (stationDistance: number | null): JSX.Element | null => {
    const { t } = useTranslation()

    if (stationDistance === null) return null
    return (
        <>
            {stationDistance <= 1 ? (
                <strong>{t('MarkerModal.oneStation')} </strong>
            ) : (
                <strong>
                    {stationDistance} {t('MarkerModal.stations')}{' '}
                </strong>
            )}
            {t('MarkerModal.fromYou')}
        </>
    )
}

/**
 * Generates a JSX Element displaying a human-readable message about elapsed time.
 *
 * @param {number} elapsedTimeInMinutes - The elapsed time in minutes.
 * @returns {JSX.Element} A span element containing the formatted time message.
 *
 * The function handles three cases:
 * 1. If the elapsed time is more than 60 minutes, it displays the time in hours.
 * 2. If the elapsed time is 1 minute or less, it displays "Jetzt".
 * 3. For any other duration, it displays the time in minutes.
 */
export const useElapsedTimeMessage = (elapsedTimeInMinutes: number, isHistoric: boolean): JSX.Element => {
    const { t, i18n } = useTranslation()
    const currentLanguage = i18n.language

    if (isHistoric || (elapsedTimeInMinutes > 45 && elapsedTimeInMinutes < 60)) {
        return (
            <span className="elapsed-time">
                {t('MarkerModal.moreThan')} <strong>{t('MarkerModal.moreThan45Minutes')}</strong>
            </span>
        )
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
                {currentLanguage === 'de' ? `${t('MarkerModal.ago')} ` : ''}
                <strong>
                    {Math.floor(elapsedTimeInMinutes / 60)} {t('MarkerModal.hours')}
                </strong>
                {currentLanguage === 'en' ? ` ${t('MarkerModal.ago')}` : ''}
            </span>
        )
    }
    if (elapsedTimeInMinutes <= 1) {
        return (
            <span className="elapsed-time">
                <strong>{t('MarkerModal.now')}</strong>
            </span>
        )
    }
    return (
        <span className="elapsed-time">
            {currentLanguage === 'de' ? `${t('MarkerModal.ago')} ` : ''}
            <strong>
                {elapsedTimeInMinutes} {t('MarkerModal.minutes')}
            </strong>
            {currentLanguage === 'en' ? ` ${t('MarkerModal.ago')}` : ''}
        </span>
    )
}
