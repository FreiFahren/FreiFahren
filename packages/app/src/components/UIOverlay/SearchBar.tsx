import { Feather } from '@expo/vector-icons'
import { ComponentProps } from 'react'

import { FFText } from '../common/base'
import { FFBox } from '../common/FFBox'

type SearchBarProps = ComponentProps<typeof FFBox>

export const SearchBar = (props: SearchBarProps) => {
    return (
        <FFBox borderRadius="full" px="s" flexDirection="row" alignItems="center" {...props}>
            <Feather name="search" color="whiteish" size={18} />
            <FFText color="whiteish" variant="large" opacity={0.8} ml="xxs">
                Search...
            </FFText>
        </FFBox>
    )
}
