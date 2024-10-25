import { Octicons } from '@expo/vector-icons'
import { Button, useTheme } from 'native-base'
import { ComponentProps, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

import { Theme } from '../../theme'
import { FFButton } from '../common/FFButton'
import { ReportSheet, ReportSheetMethods } from './ReportSheet'

type ReportButtonProps = Omit<ComponentProps<typeof Button>, 'onPress'>

export const ReportButton = (props: ReportButtonProps) => {
    const { t } = useTranslation('makeReport')
    const modalRef = useRef<ReportSheetMethods>(null)
    const theme = useTheme() as Theme

    return (
        <>
            <FFButton onPress={() => modalRef.current?.open()} bg="blue" borderColor="blue" {...props}>
                <Octicons name="report" size={24} color={theme.colors.bg} />
                <Text
                    style={{
                        color: theme.colors.bg,
                        fontSize: 20,
                        fontWeight: 'bold',
                        marginLeft: 10,
                    }}
                >
                    {t('submit')}
                </Text>
            </FFButton>
            <ReportSheet ref={modalRef} />
        </>
    )
}
