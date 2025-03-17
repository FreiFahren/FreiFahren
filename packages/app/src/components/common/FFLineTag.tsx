import { isNil } from 'lodash'
import { ComponentProps } from 'react'

import { useLines } from '../../api/queries'
import { Theme } from '../../theme'
import { FFText, FFView } from './base'

const getLineColor = (line: string) => (line.startsWith('M') ? 'lines.tram' : `lines.${line}`) as keyof Theme['colors']

type LineTagProps = {
    line: string | null | undefined
    fallbackColor?: keyof Theme['colors']
    textProps?: ComponentProps<typeof FFText>
} & ComponentProps<typeof FFView>

export const FFLineTag = ({ line, fallbackColor = 'danger', textProps, ...props }: LineTagProps) => {
    const { data: lines } = useLines()
    const isValidLine = !isNil(line) && lines !== undefined && line in lines
    const bgColor = isValidLine ? getLineColor(line as string) : fallbackColor

    return (
        <FFView bg={bgColor} px="xxs" borderRadius="s" {...props}>
            <FFText color="fg" textAlign="center" variant="labelBold" {...textProps}>
                {line ?? ' ? '}
            </FFText>
        </FFView>
    )
}
