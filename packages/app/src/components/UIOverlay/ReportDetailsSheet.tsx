import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useStationStatistics } from '../../api/queries'
import { useAppStore } from '../../app.store'
import { FFText } from '../common/base'
import { FFScrollSheet } from '../common/FFSheet'
import { ReportItem } from '../common/ReportItem'

export const ReportDetailsSheet = () => {
    const { t } = useTranslation('reportDetails')
    const sheetRef = useRef<BottomSheetModalMethods>(null)

    const report = useAppStore((state) => state.reportToShow)

    useEffect(() => {
        if (report !== null) sheetRef.current?.present()
    }, [report])

    const statistics = useStationStatistics(report?.stationId)

    if (report === null) return null

    return (
        <FFScrollSheet ref={sheetRef} backdropType="none">
            <ReportItem report={report} />
            {statistics.data !== undefined && statistics.data.numberOfReports > 1 && (
                <FFText fontSize={15} mt="xs" color="darkText">
                    {t('thisWeek', { count: statistics.data.numberOfReports })}
                </FFText>
            )}
        </FFScrollSheet>
    )
}
