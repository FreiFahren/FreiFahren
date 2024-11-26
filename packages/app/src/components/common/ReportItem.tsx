import { TFunction } from 'i18next'
import { isNil } from 'lodash'
import { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Report } from '../../api'
import { useStations } from '../../api/queries'
import { FFText, FFView } from './base'
import { FFLineTag } from './FFLineTag'

const formatTime = (date: Date, t: TFunction<'reportDetails'>) => {
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

type ReportItemProps = {
    report: Report
} & ComponentProps<typeof FFView>

export const ReportItem = ({ report, ...props }: ReportItemProps) => {
    const { t } = useTranslation('reportDetails')
    const station = useStations().data?.[report.stationId]

    return (
        <FFView {...props}>
            <FFView gap="xxs" flexDirection="row" alignItems="center">
                <FFLineTag line={report.line} />
                <FFText variant="labelBold">{station?.name}</FFText>
            </FFView>
            <FFView flexDirection="row" gap="s" mt="xxs">
                <FFText color="darkText" fontSize={15}>
                    {report.isHistoric ? t('historicLabel') : formatTime(report.timestamp, t)}
                    {`, ${t('direction')} `}
                    {isNil(report.direction?.name) ? (
                        t('unknownDirection')
                    ) : (
                        <FFText variant="label" fontSize={15}>
                            {report.direction.name}
                        </FFText>
                    )}
                </FFText>
            </FFView>
        </FFView>
    )
}
