import { Text, View } from 'native-base'
import { ComponentProps } from 'react'

const getLineColor = (line: string) => (line.startsWith('M') ? 'lines.tram' : `lines.${line}`)

type LineTagProps = {
    line: string | null
    textProps?: ComponentProps<typeof Text>
} & ComponentProps<typeof View>

export const FFLineTag = ({ line, textProps, ...props }: LineTagProps) => (
    <View bg={line === null ? 'gray.500' : getLineColor(line)} px={2} borderRadius={4} {...props}>
        <Text color="white" textAlign="center" fontSize="md" bold {...textProps}>
            {line ?? ' ? '}
        </Text>
    </View>
)
