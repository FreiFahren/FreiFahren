import { ComponentProps } from 'react'

import { Theme } from '../../theme'
import { FFText, FFView } from './base'

const getLineColor = (line: string) => (line.startsWith('M') ? 'lines.tram' : `lines.${line}`) as keyof Theme['colors']

type LineTagProps = {
    line: string | null
    textProps?: ComponentProps<typeof FFText>
} & ComponentProps<typeof FFView>

export const FFLineTag = ({ line, textProps, ...props }: LineTagProps) => (
    <FFView bg={line === null ? 'lines.unknown' : getLineColor(line)} px="xxs" borderRadius="s" {...props}>
        <FFText color="fg" textAlign="center" variant="labelBold" {...textProps}>
            {line ?? ' ? '}
        </FFText>
    </FFView>
)
