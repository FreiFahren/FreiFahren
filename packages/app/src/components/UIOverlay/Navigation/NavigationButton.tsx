import { FontAwesome5 } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { ComponentProps, useRef } from 'react'

import { track } from '../../../tracking'
import { FFButton } from '../../common/base'
import { NavigationSheet } from './NavigationSheet'

export const NavigationButton = (props: ComponentProps<typeof FFButton>) => {
    const sheetRef = useRef<BottomSheetModalMethods>(null)

    const handleOpen = () => {
        track({ name: 'Navigation Opened' })
        sheetRef.current?.present()
    }

    return (
        <>
            <NavigationSheet ref={sheetRef} />
            <FFButton variant="square" onPress={handleOpen} {...props}>
                <FontAwesome5 name="directions" size={26} color="white" />
            </FFButton>
        </>
    )
}
