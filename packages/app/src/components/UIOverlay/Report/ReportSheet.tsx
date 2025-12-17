import { Octicons } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useTheme } from '@shopify/restyle'
import { forwardRef, PropsWithChildren, Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutAnimation } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'

import { useSubmitReport } from '../../../api'
import { useLines, useStations } from '../../../api/queries'
import { useAppStore } from '../../../app.store'
import { Theme } from '../../../theme'
import { useTracking } from '../../../tracking/provider'
import { FFButton, FFText, FFView } from '../../common/base'
import { FFCarousellSelect } from '../../common/FFCarousellSelect'
import { FFLineTag } from '../../common/FFLineTag'
import { FFScrollSheet } from '../../common/FFSheet'
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

const getLineType = (line: string) => {
    if (line.startsWith('S')) return 's'
    if (line.startsWith('U')) return 'u'
    return 'm'
}

export const ReportSheet = forwardRef((_props: PropsWithChildren<{}>, ref: Ref<ReportSheetMethods>) => {
    const { track } = useTracking()
    const { t: tCommon } = useTranslation()
    const { t: tReport } = useTranslation('makeReport')
    const { mutateAsync: submitReport, isPending } = useSubmitReport()
    const { data: stations } = useStations()
    const { data: lines } = useLines()
    const sheetRef = useRef<BottomSheetModalMethods>(null)
    const theme = useTheme<Theme>()
    const updateAppStore = useAppStore((state) => state.update)

    const openedAt = useRef<number | null>(null)

    useImperativeHandle(ref, () => ({
        open: () => {
            sheetRef.current?.present()
            openedAt.current = Date.now()
            track({ name: 'Report Sheet Opened' })
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

    const isValid = selectedLine !== null && selectedStation !== null

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
        () => Object.keys(lines ?? {}).filter((line) => getLineType(line) === lineType),
        [lineType, lines]
    )

    if (lines === undefined || stations === undefined) return null

    const directionOptions =
        selectedLine === null ? [] : [lines[selectedLine][0], lines[selectedLine][lines[selectedLine].length - 1]]

    const stationOptions = selectedLine === null ? [] : lines[selectedLine]

    const isDisabled = !isValid || isPending

    const shouldShowDirection = !(['S41', 'S42'] as (typeof selectedLine)[]).includes(selectedLine)

    const close = () => {
        sheetRef.current?.close()

        setLineType('u')
        setSelectedLine(null)
    }

    const onSubmit = async () => {
        if (!isValid) return

        const duration = Math.floor((Date.now() - openedAt.current!) / 1000)

        const data = {
            line: selectedLine,
            stationId: selectedStation,
            directionId: selectedDirection,
        }

        track({
            name: 'Report Submitted',
            duration,
            ...data,
        })

        const newReport = await submitReport(data)

        close()

        updateAppStore({ reportToShow: newReport })
    }

    return (
        <FFScrollSheet ref={sheetRef} onDismiss={close}>
            <FFView>
                <FFText variant="header1" mb="xs" color="fg">
                    {tReport('title')}
                </FFText>
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
                <FFView style={{ marginHorizontal: -theme.spacing.sm }}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: theme.spacing.sm }}
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
                                        {stations[direction]?.name ?? '?'}
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
                                        {stations[station]?.name ?? '?'}
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
                marginTop="m"
                opacity={isDisabled ? 0.5 : 1}
            >
                {isPending ? (
                    <FFSpinner color1="white" size={24} />
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
        </FFScrollSheet>
    )
})
