import { Feather } from '@expo/vector-icons'
import { Image, Pressable, Row, Text, View } from 'native-base'
import { ComponentProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

import linesIcon from '../../../assets/lines.png'
import riskIcon from '../../../assets/risk.png'
import { useAppStore } from '../../app.store'
import { track } from '../../tracking'
import { FFButton } from '../common/FFButton'

const LAYER_BUTTON_SIZE = 45

export const LayerSwitcher = (props: ComponentProps<typeof Row>) => {
    const { t } = useTranslation('map')
    const [isOpen, setIsOpen] = useState(false)

    const { layer: currentLayer, update } = useAppStore()

    const handleSelect = (layer: 'risk' | 'lines') => {
        track({ name: 'Layer Selected', layer })

        update({ layer })
        setIsOpen(false)
    }

    return (
        <Row space={2} alignItems="flex-start" {...props}>
            {isOpen && (
                <View flexDir="row" borderRadius={7} bg="bg" borderWidth={3} borderColor="bg2" p={1}>
                    {(['risk', 'lines'] as const).map((layer, index) => (
                        <Pressable
                            onPress={() => handleSelect(layer)}
                            hitSlop={10}
                            key={layer}
                            borderRadius={5}
                            borderWidth={2}
                            borderColor={layer === currentLayer ? 'selected' : undefined}
                            mr={index === 0 ? 2 : 0}
                            justifyContent="flex-end"
                            width={LAYER_BUTTON_SIZE}
                            height={LAYER_BUTTON_SIZE}
                            overflow="hidden"
                        >
                            <Image
                                source={layer === 'risk' ? riskIcon : linesIcon}
                                width={LAYER_BUTTON_SIZE}
                                height={LAYER_BUTTON_SIZE}
                                position="absolute"
                                alt={layer}
                                top={0}
                                right={0}
                                left={0}
                                bottom={0}
                            />
                            <View bg="rgba(0, 0, 0, 0.5)" alignSelf="stretch" alignItems="center">
                                <Text color="white" fontSize={12}>
                                    {t(`layers.${layer}`)}
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
            )}
            <FFButton onPress={() => setIsOpen((prev) => !prev)}>
                <Feather name="layers" size={24} color="white" />
            </FFButton>
        </Row>
    )
}
