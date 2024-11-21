import { ComponentProps } from 'react'

import { FFView } from './base'

type FFBoxProps = ComponentProps<typeof FFView>

export const FFBox = (props: FFBoxProps) => (
    <FFView bg="bg" borderRadius="m" borderColor="bg2" borderWidth={2} p="xs" {...props} />
)
