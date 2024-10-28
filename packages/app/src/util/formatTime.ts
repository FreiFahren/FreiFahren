import { TFunction } from 'i18next'

export const formatTime = (date: Date, t: TFunction<'reportDetails'>) => {
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)

    if (diffMins <= 1) return t('now')

    if (diffMins < 30) return t('minAgo', { minutes: diffMins })

    return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
    })
}
