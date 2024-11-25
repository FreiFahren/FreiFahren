import { Entypo } from '@expo/vector-icons'
import { ComponentProps, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionSheetRef } from 'react-native-actions-sheet'

import { track } from '../../../tracking'
import { FFButton, FFText } from '../../common/base'
import { ReportListSheet } from './ReportListSheet'

type ReportListButtonProps = Partial<ComponentProps<typeof FFButton>>

export const ReportListButton = (props: ReportListButtonProps) => {
    const { t } = useTranslation('reportList')
    const sheetRef = useRef<ActionSheetRef>(null)

    const handleOpen = () => {
        track({ name: 'Reports Viewed' })
        sheetRef.current?.show()
    }

    return (
        <>
            <FFButton onPress={handleOpen} variant="secondary" {...props}>
                <Entypo name="menu" size={22} color="white" />
                <FFText color="fg" variant="labelLarge" ml="xxs">
                    {t('button')}
                </FFText>
            </FFButton>
            <ReportListSheet ref={sheetRef} />
        </>
    )
}
