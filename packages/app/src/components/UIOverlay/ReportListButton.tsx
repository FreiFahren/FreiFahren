import { Entypo } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useTheme } from 'native-base'
import { ComponentProps, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

import { Theme } from '../../theme'
import { FFButton } from '../common/FFButton'
import { ReportListSheet } from './ReportListSheet'

type ReportListButtonProps = Partial<ComponentProps<typeof FFButton>>

export const ReportListButton = (props: ReportListButtonProps) => {
    const { t } = useTranslation('reportList')
    const sheetRef = useRef<BottomSheetModalMethods>(null)

    const theme = useTheme() as Theme

    return (
        <>
            <FFButton onPress={() => sheetRef.current?.present()} {...props}>
                <Entypo name="menu" size={22} color="white" />
                <Text
                    style={{
                        color: theme.colors.white,
                        fontSize: 20,
                        fontWeight: 'bold',
                        marginLeft: 10,
                    }}
                >
                    {t('button')}
                </Text>
            </FFButton>
            <ReportListSheet ref={sheetRef} />
        </>
    )
}
