import { Octicons } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { Box, Row, Text, useTheme, View } from 'native-base'
import { forwardRef, PropsWithChildren, Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutAnimation } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'

import { useSubmitReport } from '../../../api'
import { useLines, useStations } from '../../../api/queries'
import { Theme } from '../../../theme'
import { track } from '../../../tracking'
import { FFButton } from '../../common/FFButton'
import { FFCarousellSelect } from '../../common/FFCarousellSelect'
import { FFLineTag } from '../../common/FFLineTag'
import { FFScrollSheet } from '../../common/FFSheet'
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
    const theme = useTheme() as Theme
    const { mutateAsync: submitReport, isPending } = useSubmitReport()
    const { data: stations } = useStations()
    const { data: lines } = useLines()
    const sheetRef = useRef<BottomSheetModalMethods>(null)

    const openedAt = useRef<number | null>(null)

    useImperativeHandle(ref, () => ({
        open: () => {
            track({ name: 'Report Sheet Opened' })
            sheetRef.current?.present()
            openedAt.current = Date.now()
        },
        close: () => {
            sheetRef.current?.close()
            openedAt.current = null
        },
    }))

    const [lineType, setLineType] = useState<LineType>('u')
    const [selectedLine, setSelectedLine] = useState<string | null>(null)
    const [selectedDirection, setSelectedDirection] = useState<string | null>(null)
    const [selectedStation, setSelectedStation] = useState<string | null>(null)

    const isValid = selectedLine !== null && selectedStation !== null && selectedDirection !== null

    useEffect(() => setSelectedLine(null), [lineType])
    useEffect(() => {
        if (selectedLine !== null) {
            sheetRef.current?.expand()
        }
        setSelectedDirection(null)
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }, [selectedLine])
    useEffect(() => setSelectedStation(null), [selectedLine])

    const lineOptions = useMemo(
        () => Object.keys(lines ?? {}).filter((line) => line.toLowerCase().startsWith(lineType)),
        [lineType, lines]
    )

    if (lines === undefined || stations === undefined) return null

    const directionOptions =
        selectedLine === null ? [] : [lines[selectedLine][0], lines[selectedLine][lines[selectedLine].length - 1]]

    const stationOptions = selectedLine === null ? [] : lines[selectedLine]

    const close = () => {
        sheetRef.current?.close()

        setLineType('u')
        setSelectedLine(null)
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
        <FFScrollSheet ref={sheetRef} onDismiss={close}>
            <Box justifyContent="space-between" overflow="visible" position="relative" flex={1} safeAreaBottom>
                <View>
                    <Text bold fontSize="xl" mb={4} color="white">
                        {tReport('title')}
                    </Text>
                    <FFCarousellSelect
                        options={lineTypes}
                        selectedOption={lineType}
                        onSelect={(option: LineType) => setLineType(option)}
                        containerProps={{ py: 3, flex: 1 }}
                        renderOption={(option) => ({ u: <UbahnIcon />, s: <SbahnIcon />, m: <TramIcon /> })[option]}
                    />
                    <Text fontSize="md" fontWeight="bold" color="white" mt={4} mb={2}>
                        {tCommon('line')}
                    </Text>
                    <View mx={-4}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: theme.space[5] }}
                        >
                            <FFCarousellSelect
                                options={lineOptions}
                                selectedOption={selectedLine}
                                onSelect={setSelectedLine}
                                containerProps={{ py: 3, px: 4 }}
                                renderOption={(line) => <FFLineTag line={line} textProps={{ fontSize: '2xl' }} />}
                            />
                        </ScrollView>
                    </View>
                    {selectedLine !== null && (
                        <>
                            <Text fontSize="md" fontWeight="bold" color="white" mt={4} mb={2}>
                                {tCommon('direction')}
                            </Text>
                            <FFCarousellSelect
                                vertical
                                options={directionOptions}
                                selectedOption={selectedDirection}
                                onSelect={setSelectedDirection}
                                containerProps={{ py: 3, px: 4 }}
                                renderOption={(direction, isSelected) => (
                                    <Row alignSelf="flex-start">
                                        <Text color="white" bold={isSelected}>
                                            {stations[direction].name}
                                        </Text>
                                    </Row>
                                )}
                            />
                            <Text fontSize="md" fontWeight="bold" color="white" mt={4} mb={2}>
                                {tCommon('station')}
                            </Text>
                            <FFCarousellSelect
                                vertical
                                collapses
                                options={stationOptions}
                                selectedOption={selectedStation}
                                onSelect={setSelectedStation}
                                containerProps={{ py: 3, px: 4 }}
                                renderOption={(station, isSelected) => (
                                    <Row alignSelf="flex-start">
                                        <Text color="white" bold={isSelected}>
                                            {stations[station].name}
                                        </Text>
                                    </Row>
                                )}
                            />
                        </>
                    )}
                </View>
                <FFButton
                    onPress={onSubmit}
                    isDisabled={isPending || !isValid}
                    bg={isPending ? 'bg' : 'blue'}
                    mt={8}
                    borderWidth={isPending ? 3 : 0}
                >
                    <Octicons name="report" size={24} color={theme.colors.bg} />
                    <Text
                        style={{
                            color: theme.colors.bg,
                            fontSize: 20,
                            fontWeight: 'bold',
                            marginLeft: 10,
                        }}
                    >
                        {tReport('submit')}
                    </Text>
                </FFButton>
            </Box>
        </FFScrollSheet>
    )
})
