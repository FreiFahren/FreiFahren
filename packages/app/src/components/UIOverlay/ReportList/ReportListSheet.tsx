import { useBottomSheetModal } from '@gorhom/bottom-sheet'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { forwardRef, PropsWithChildren, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'

import { useReports } from '../../../api'
import { useAppStore } from '../../../app.store'
import { FFText, FFView } from '../../common/base'
import { FFScrollSheet } from '../../common/FFSheet'
import { FFSpinner } from '../../common/FFSpinner'
import { ReportItem } from '../../common/ReportItem'

export const ReportListSheet = forwardRef((_props: PropsWithChildren<{}>, ref: Ref<BottomSheetModalMethods>) => {
    const { t } = useTranslation('reportList')
    const updateAppStore = useAppStore((state) => state.update)
    const { dismissAll } = useBottomSheetModal()
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
                    {reports.map((report, index) => (
                        <Pressable
                            onPress={() => {
                                dismissAll()
                                updateAppStore({ reportToShow: report })
                            }}
                            key={`${report.stationId}-${report.timestamp.getMilliseconds()}`}
                        >
                            <ReportItem
                                report={report}
                                py="xs"
                                borderTopWidth={index === 0 ? 0 : 1}
                                borderColor="bg2"
                            />
                        </Pressable>
                    ))}
                </FFView>
            )}
        </FFScrollSheet>
    )
})
