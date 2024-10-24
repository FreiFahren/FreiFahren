import { Pressable } from 'native-base'
import { ComponentProps, PropsWithChildren } from 'react'

type FFButtonProps = PropsWithChildren<ComponentProps<typeof Pressable>>

export const FFButton = ({ children, ...props }: FFButtonProps) => (
    <Pressable
        backgroundColor="bg"
        borderRadius={24}
        borderColor="bg2"
        borderWidth={3}
        flexDir="row"
        alignItems="center"
        justifyContent="center"
        px={5}
        py={3}
        {...props}
    >
        {children}
    </Pressable>
)
