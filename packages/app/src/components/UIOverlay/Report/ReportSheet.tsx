import { Octicons } from '@expo/vector-icons'
import { useTheme } from '@shopify/restyle'
import { forwardRef, PropsWithChildren, Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutAnimation, ScrollView as RNScrollView } from 'react-native'
import { ActionSheetRef, ScrollView } from 'react-native-actions-sheet'

import { useSubmitReport } from '../../../api'
import { useLines, useStations } from '../../../api/queries'
import { Theme } from '../../../theme'
import { track } from '../../../tracking'
import { FFButton, FFSafeAreaView, FFText, FFView } from '../../common/base'
import { FFCarousellSelect } from '../../common/FFCarousellSelect'
import { FFLineTag } from '../../common/FFLineTag'
import { FFScrollSheet, FFSheetHeader } from '../../common/FFSheet'
import { FFSpinner } from '../../common/FFSpinner'
import { SbahnIcon } from './SbahnIcon'
import { TramIcon } from './TramIcon'
import { UbahnIcon } from './UbahnIcon'

const lineTypes = ['u' as const, 's' as const, 'm' as const]

type LineType = (typeof lineTypes)[number]

export type ReportSheetMethods = {
    open: () => void
    close: () => void
}

export const ReportSheet = forwardRef((_props: PropsWithChildren<{}>, ref: Ref<ReportSheetMethods>) => {
    const { t: tCommon } = useTranslation()
    const { t: tReport } = useTranslation('makeReport')
    const { mutateAsync: submitReport, isPending } = useSubmitReport()
    const { data: stations } = useStations()
    const { data: lines } = useLines()
    const sheetRef = useRef<ActionSheetRef>(null)
    const scrollViewRef = useRef<RNScrollView>(null)
    const theme = useTheme<Theme>()

    const openedAt = useRef<number | null>(null)

    useImperativeHandle(ref, () => ({
        open: () => {
            sheetRef.current?.show()
            openedAt.current = Date.now()
            track({ name: 'Report Sheet Opened' })
        },
        close: () => {
            sheetRef.current?.hide()
            openedAt.current = null
        },
    }))

    const [lineType, setLineType] = useState<LineType>('u')
    const [selectedLine, setSelectedLine] = useState<string | null>(null)
    const [selectedDirection, setSelectedDirection] = useState<string | null>(null)
    const [selectedStation, setSelectedStation] = useState<string | null>(null)

    const isValid = selectedLine !== null && selectedStation !== null

    useEffect(() => setSelectedLine(null), [lineType])
    useEffect(() => {
        sheetRef.current?.snapToOffset(80)
        setSelectedDirection(null)
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }, [selectedLine])
    useEffect(() => setSelectedStation(null), [selectedLine])
    useEffect(() => {
        sheetRef.current?.snapToOffset(80)
        scrollViewRef.current?.scrollToEnd()
    }, [selectedStation])

    const lineOptions = useMemo(
        () => Object.keys(lines ?? {}).filter((line) => line.toLowerCase().startsWith(lineType)),
        [lineType, lines]
    )

    if (lines === undefined || stations === undefined) return null

    const directionOptions =
        selectedLine === null ? [] : [lines[selectedLine][0], lines[selectedLine][lines[selectedLine].length - 1]]

    const stationOptions = selectedLine === null ? [] : lines[selectedLine]

    const isDisabled = !isValid || isPending

    const shouldShowDirection = selectedLine !== 'S42' && selectedLine !== 'S41'

    const reset = () => {
        setLineType('u')
        setSelectedLine(null)
    }

    const close = () => {
        sheetRef.current?.hide()
        reset()
    }

    const onSubmit = async () => {
        if (!isValid) return

        track({ name: 'Report Submitted', duration: (Date.now() - openedAt.current!) / 1000 })

        await submitReport({
            line: selectedLine,
            stationId: selectedStation,
            directionId: selectedDirection,
        })

        close()
    }

    return (
        <FFScrollSheet ref={sheetRef} snapPoints={[100]} onClose={close}>
            <FFSafeAreaView
                justifyContent="space-between"
                overflow="visible"
                position="relative"
                flex={1}
                edges={['bottom']}
            >
                <FFView>
                    <FFSheetHeader title={tReport('title')} ref={sheetRef} onClose={reset} mb="xs" />
                    <FFCarousellSelect
                        options={lineTypes}
                        selectedOption={lineType}
                        onSelect={(option: LineType) => setLineType(option)}
                        containerProps={{ py: 's', flex: 1 }}
                        renderOption={(option) => ({ u: <UbahnIcon />, s: <SbahnIcon />, m: <TramIcon /> })[option]}
                    />
                    <FFText variant="header2" fontWeight="bold" color="fg" mt="xs" mb="xxs">
                        {tCommon('line')}
                    </FFText>
                    <FFView style={{ marginHorizontal: -theme.spacing.s }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: theme.spacing.xs }}
                        >
                            <FFCarousellSelect
                                options={lineOptions}
                                selectedOption={selectedLine}
                                onSelect={setSelectedLine}
                                containerProps={{ py: 'xs', px: 'xs' }}
                                renderOption={(line) => <FFLineTag line={line} textProps={{ variant: 'header1' }} />}
                            />
                        </ScrollView>
                    </FFView>
                    {selectedLine !== null && shouldShowDirection && (
                        <>
                            <FFText variant="header2" fontWeight="bold" color="fg" mt="xs" mb="xxs">
                                {tCommon('direction')}
                            </FFText>
                            <FFCarousellSelect
                                vertical
                                options={directionOptions}
                                selectedOption={selectedDirection}
                                onSelect={setSelectedDirection}
                                containerProps={{
                                    py: 'xs',
                                    px: 'xs',
                                    justifyContent: 'flex-start',
                                }}
                                renderOption={(direction, isSelected) => (
                                    <FFView flexDirection="row">
                                        <FFText fontWeight={isSelected ? 'bold' : undefined}>
                                            {stations[direction].name}
                                        </FFText>
                                    </FFView>
                                )}
                            />
                        </>
                    )}
                    {selectedLine !== null && (
                        <>
                            <FFText variant="header2" fontWeight="bold" mt="xs" mb="xxs">
                                {tCommon('station')}
                            </FFText>
                            <FFCarousellSelect
                                vertical
                                collapses
                                options={stationOptions}
                                selectedOption={selectedStation}
                                onSelect={setSelectedStation}
                                containerProps={{
                                    py: 'xs',
                                    px: 'xs',
                                    justifyContent: 'flex-start',
                                }}
                                renderOption={(station, isSelected) => (
                                    <FFView flexDirection="row" alignSelf="flex-start">
                                        <FFText fontWeight={isSelected ? 'bold' : undefined}>
                                            {stations[station].name}
                                        </FFText>
                                    </FFView>
                                )}
                            />
                        </>
                    )}
                </FFView>
                <FFButton
                    variant="primary"
                    onPress={onSubmit}
                    disabled={isDisabled}
                    marginVertical="m"
                    opacity={isDisabled ? 0.7 : 1}
                >
                    {isPending ? (
                        <FFSpinner size={24} />
                    ) : (
                        <>
                            <Octicons name="report" size={24} color="white" />
                            <FFText
                                style={{
                                    color: 'white',
                                    fontSize: 20,
                                    fontWeight: 'bold',
                                    marginLeft: 10,
                                }}
                            >
                                {tReport('submit')}
                            </FFText>
                        </>
                    )}
                </FFButton>
            </FFSafeAreaView>
        </FFScrollSheet>
    )
})
