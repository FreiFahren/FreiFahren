import { TrueSheet, TrueSheetProps } from '@lodev09/react-native-true-sheet'
import { useTheme } from '@shopify/restyle'
import { forwardRef, PropsWithChildren, Ref, useRef } from 'react'
import { ScrollView } from 'react-native-gesture-handler'

import { Theme } from '../../theme'
import { FFView } from './base'

const FFSheetBase = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<TrueSheetProps>>, ref: Ref<TrueSheet>) => {
        const theme = useTheme<Theme>()

        return (
            <TrueSheet
                ref={ref}
                backgroundColor={theme.colors.bg}
                cornerRadius={theme.borderRadii.m}
                style={{ borderWidth: 2, borderBottomWidth: 0, borderColor: theme.colors.border }}
                sizes={['auto', 'large']}
                {...props}
            >
                {children}
            </TrueSheet>
        )
    }
)

export const FFSheet = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<TrueSheetProps>>, ref: Ref<TrueSheet>) => (
        <FFSheetBase ref={ref} {...props}>
            <FFView px="sm" py="sm">
                {children}
            </FFView>
        </FFSheetBase>
    )
)
export const FFScrollSheet = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<TrueSheetProps>>, ref: Ref<TrueSheet>) => {
        const scrollRef = useRef<ScrollView>(null)

        return (
            <FFSheetBase ref={ref} scrollRef={scrollRef} {...props}>
                <ScrollView ref={scrollRef} style={{ flexGrow: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                    <FFView px="sm" py="sm" flexGrow={1}>
                        {children}
                    </FFView>
                </ScrollView>
            </FFSheetBase>
        )
    }
)
