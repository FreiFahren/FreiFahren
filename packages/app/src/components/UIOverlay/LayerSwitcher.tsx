import { Feather } from '@expo/vector-icons'
import { ComponentProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

import linesIcon from '../../../assets/lines.png'
import riskIcon from '../../../assets/risk.png'
import { useAppStore } from '../../app.store'
import { track } from '../../tracking'
import { FFButton, FFImage, FFPressable, FFText, FFView } from '../common/base'

const LAYER_BUTTON_SIZE = 55

export const LayerSwitcher = (props: ComponentProps<typeof FFView>) => {
    const { t } = useTranslation('map')
    const [isOpen, setIsOpen] = useState(false)

    const { layer: currentLayer, update } = useAppStore()

    const handleSelect = (layer: 'risk' | 'lines') => {
        track({ name: 'Layer Selected', layer })

        update({ layer })
        setIsOpen(false)
    }

    return (
        <FFView flexDirection="row" gap="xxs" alignItems="flex-start" {...props}>
            {isOpen && (
                <FFView
                    flexDirection="row"
                    style={{ borderRadius: 7 }}
                    bg="bg"
                    borderWidth={3}
                    borderColor="border"
                    p="xxxs"
                >
                    {(['risk', 'lines'] as const).map((layer, index) => (
                        <FFPressable
                            onPress={() => handleSelect(layer)}
                            hitSlop={10}
                            key={layer}
                            borderRadius="s"
                            borderWidth={2}
                            borderColor={layer === currentLayer ? 'selected' : undefined}
                            mr={index === 0 ? 'xxs' : undefined}
                            justifyContent="flex-end"
                            width={LAYER_BUTTON_SIZE}
                            height={LAYER_BUTTON_SIZE}
                            overflow="hidden"
                        >
                            <FFImage
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
                            <FFView
                                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                                alignSelf="stretch"
                                alignItems="center"
                            >
                                <FFText variant="small" color="fg">
                                    {t(`layers.${layer}`)}
                                </FFText>
                            </FFView>
                        </FFPressable>
                    ))}
                </FFView>
            )}
            <FFButton variant="square" onPress={() => setIsOpen((prev) => !prev)}>
                <Feather name="layers" size={24} color="white" />
            </FFButton>
        </FFView>
    )
}
