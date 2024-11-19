import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { Stack, Text, View } from 'native-base'
import { forwardRef, PropsWithChildren, Ref } from 'react'
import { useTranslation } from 'react-i18next'

import { useReports } from '../../../api'
import { FFScrollSheet } from '../../common/FFSheet'
import { FFSpinner } from '../../common/FFSpinner'
import { ReportItem } from '../../common/ReportItem'

export const ReportListSheet = forwardRef((_props: PropsWithChildren<{}>, ref: Ref<BottomSheetModalMethods>) => {
    const { t } = useTranslation('reportList')
    const { data: reports } = useReports()

    return (
        <FFScrollSheet ref={ref}>
            <Text fontSize="xl" color="white" bold>
                {t('title')}
            </Text>
            {reports?.length === 0 ? (
                <Text color="fg">{t('empty')}</Text>
            ) : reports === undefined ? (
                <View flex={1}>
                    <FFSpinner />
                </View>
            ) : (
                <View mt={4}>
                    <Stack pb={12}>
                        {reports.map((report, index) => (
                            <ReportItem
                                key={`${report.stationId}-${report.timestamp.getMilliseconds()}`}
                                report={report}
                                py={3}
                                pt={index === 0 ? 0 : undefined}
                                borderTopWidth={index === 0 ? 0 : 1}
                                borderColor="bg2"
                            />
                        ))}
                    </Stack>
                </View>
            )}
        </FFScrollSheet>
    )
})
