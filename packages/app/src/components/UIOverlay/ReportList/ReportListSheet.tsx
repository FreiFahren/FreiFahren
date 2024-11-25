import { forwardRef, PropsWithChildren, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionSheetRef } from 'react-native-actions-sheet'

import { useReports } from '../../../api'
import { FFText, FFView } from '../../common/base'
import { FFScrollSheet } from '../../common/FFSheet'
import { FFSpinner } from '../../common/FFSpinner'
import { ReportItem } from '../../common/ReportItem'

export const ReportListSheet = forwardRef((_props: PropsWithChildren<{}>, ref: Ref<ActionSheetRef>) => {
    const { t } = useTranslation('reportList')
    const { data: reports } = useReports()

    return (
        <FFScrollSheet ref={ref}>
            <FFText variant="header1">{t('title')}</FFText>
            {reports?.length === 0 ? (
                <FFText>{t('empty')}</FFText>
            ) : reports === undefined ? (
                <FFView flex={1}>
                    <FFSpinner />
                </FFView>
            ) : (
                <FFView mt="xs">
                    <FFView pb="s">
                        {reports.map((report, index) => (
                            <ReportItem
                                key={`${report.stationId}-${report.timestamp.getMilliseconds()}`}
                                report={report}
                                py="xs"
                                borderTopWidth={index === 0 ? 0 : 1}
                                borderColor="bg2"
                            />
                        ))}
                    </FFView>
                </FFView>
            )}
        </FFScrollSheet>
    )
})
