import { Entypo } from '@expo/vector-icons'
import { useTheme } from '@shopify/restyle'
import { ComponentProps, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Theme } from '../../../theme'
import { FFButton, FFText } from '../../common/base'
import { ReportSheet, ReportSheetMethods } from './ReportSheet'

// <Octicons name="report" size={24} color={theme.colors.white} />

type ReportButtonProps = Omit<ComponentProps<typeof FFButton>, 'onPress'>

export const ReportButton = (props: ReportButtonProps) => {
    const { t } = useTranslation('makeReport')
    const modalRef = useRef<ReportSheetMethods>(null)
    const theme = useTheme<Theme>()

    return (
        <>
            <FFButton variant="primary" onPress={() => modalRef.current?.open()} {...props}>
                <Entypo name="plus" size={20} color={theme.colors.fg} />
                <FFText variant="labelLarge" ml="xxs">
                    {t('submit')}
                </FFText>
            </FFButton>
            <ReportSheet ref={modalRef} />
        </>
    )
}
