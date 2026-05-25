import { TFunction } from 'i18next'
import { isNil } from 'lodash'
import { ComponentProps, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Report } from '../../api'
import { useLines, useStations } from '../../api/queries'
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
    const { data: stations } = useStations()
    const { data: lines } = useLines()
    const station = stations?.[report.stationId]

    // Resolve line display name from lineId
    // Show public line name (e.g., "M1") not variant id (e.g., "M1-a")
    const lineDisplayName = useMemo(() => {
        if (!report.lineId || !lines) return null
        const line = lines.find((l) => l.id === report.lineId)

        return line?.name ?? report.lineId
    }, [report.lineId, lines])

    // Resolve direction name from directionId (which is a station id)
    const directionName = useMemo(() => {
        if (!report.directionId || !stations) return null
        return stations[report.directionId]?.name ?? null
    }, [report.directionId, stations])

    if (!stations || !lines) return null

    return (
        <FFView {...props}>
            <FFView gap="xxs" flexDirection="row" alignItems="center">
                <FFLineTag line={lineDisplayName} />
                <FFText variant="labelBold">{station?.name}</FFText>
            </FFView>
            <FFView flexDirection="row" gap="s" mt="xxs">
                <FFText color="darkText" fontSize={15}>
                    {report.isPredicted ? t('historicLabel') : formatTime(report.timestamp, t)}
                    {`, ${t('direction')} `}
                    {isNil(directionName) ? (
                        t('unknownDirection')
                    ) : (
                        <FFText variant="label" fontSize={15}>
                            {directionName}
                        </FFText>
                    )}
                </FFText>
            </FFView>
        </FFView>
    )
}
