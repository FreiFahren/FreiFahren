import { Octicons } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useTheme } from '@shopify/restyle'
import { forwardRef, PropsWithChildren, Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutAnimation } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'

import { Line, useSubmitReport } from '../../../api'
import { useLines, useStations } from '../../../api/queries'
import { useAppStore } from '../../../app.store'
import { Theme } from '../../../theme'
import { track } from '../../../tracking'
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

const getLineType = (lineName: string) => {
    if (lineName.startsWith('S')) return 's'
    if (lineName.startsWith('U')) return 'u'

    return 'm'
}

// Group line variants by their public name (e.g., "M1-a", "M1-b" → "M1")
const groupLinesByPublicName = (lines: Line[]) => {
    const groups = new Map<string, Line[]>()

    for (const line of lines) {
        const publicName = line.name
        const existing = groups.get(publicName) ?? []

        groups.set(publicName, [...existing, line])
    }

    return groups
}

// When submitting, find the matching variant(s) for the selected line, station, and direction
// Returns the variant ID to submit
const resolveLineVariantForSubmit = (
    publicLineName: string,
    stationId: string,
    directionId: string | null,
    linesByPublicName: Map<string, Line[]>
): string => {
    const variants = linesByPublicName.get(publicLineName) ?? []

    // Filter variants that contain the selected station
    const matchingVariants = variants.filter((v) => v.stations.includes(stationId))

    if (matchingVariants.length === 0) {
        // Shouldn't happen, but fallback to first variant
        const [firstVariant] = variants

        return firstVariant.id ?? publicLineName
    }

    if (matchingVariants.length === 1) {
        return matchingVariants[0].id
    }

    // If multiple variants match, try to narrow down by direction
    if (directionId) {
        const directionMatchingVariants = matchingVariants.filter((v) => {
            const [firstStation] = v.stations
            const lastStation = v.stations[v.stations.length - 1]

            return directionId === firstStation || directionId === lastStation
        })

        if (directionMatchingVariants.length > 0) {
            // Use the longest variant among direction matches (as per frontend pattern)
            return directionMatchingVariants.sort((a, b) => b.stations.length - a.stations.length)[0].id
        }
    }

    // Fallback: use the longest matching variant
    return matchingVariants.sort((a, b) => b.stations.length - a.stations.length)[0].id
}

export const ReportSheet = forwardRef((_props: PropsWithChildren<{}>, ref: Ref<ReportSheetMethods>) => {
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
    const [selectedPublicLine, setSelectedPublicLine] = useState<string | null>(null)
    const [selectedDirection, setSelectedDirection] = useState<string | null>(null)
    const [selectedStation, setSelectedStation] = useState<string | null>(null)

    const isValid = selectedPublicLine !== null && selectedStation !== null

    useEffect(() => setSelectedPublicLine(null), [lineType])
    useEffect(() => {
        if (selectedPublicLine !== null) {
            sheetRef.current?.expand()
        }

        setSelectedDirection(null)
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }, [selectedPublicLine])
    useEffect(() => setSelectedStation(null), [selectedPublicLine])

    // Group lines by public name for UI display
    const linesByPublicName = useMemo(() => {
        if (!lines) return new Map<string, Line[]>()

        return groupLinesByPublicName(lines)
    }, [lines])

    // Get unique public line names filtered by line type
    const publicLineOptions = useMemo(() => {
        const names = Array.from(linesByPublicName.keys()).filter((name) => getLineType(name) === lineType)

        // Sort with natural numeric ordering (S8 before S42)
        return names.sort((a, b) => {
            // Extract prefix (letters) and number parts
            const aMatch = a.match(/^([A-Z]+)(\d+)/)
            const bMatch = b.match(/^([A-Z]+)(\d+)/)

            if (!aMatch || !bMatch) return a.localeCompare(b)

            const [, aPrefix, aNumber] = aMatch
            const [, bPrefix, bNumber] = bMatch

            // Compare prefix first
            if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix)

            // Then compare numbers numerically
            return Number.parseInt(aNumber, 10) - Number.parseInt(bNumber, 10)
        })
    }, [linesByPublicName, lineType])

    // Get direction options from all variants of the selected public line
    const directionOptions = useMemo(() => {
        if (!selectedPublicLine) return []

        const variants = linesByPublicName.get(selectedPublicLine) ?? []
        const directionStationIds = new Set<string>()

        for (const variant of variants) {
            if (variant.stations.length === 0) {
                // eslint-disable-next-line no-continue
                continue
            }

            // For circular lines, we don't show direction
            if (variant.isCircular) {
                // eslint-disable-next-line no-continue
                continue
            }

            // Add first and last stations of each variant
            directionStationIds.add(variant.stations[0])
            directionStationIds.add(variant.stations[variant.stations.length - 1])
        }

        return Array.from(directionStationIds)
    }, [selectedPublicLine, linesByPublicName])

    // Get station options from all variants of the selected public line
    const stationOptions = useMemo(() => {
        if (!selectedPublicLine) return []

        const variants = linesByPublicName.get(selectedPublicLine) ?? []
        const stationIdsSet = new Set<string>()

        for (const variant of variants) {
            for (const stationId of variant.stations) {
                stationIdsSet.add(stationId)
            }
        }

        return Array.from(stationIdsSet)
    }, [selectedPublicLine, linesByPublicName])

    // Check if the selected line is circular (S41/S42)
    const shouldShowDirection = useMemo(() => {
        if (!selectedPublicLine) return false

        const variants = linesByPublicName.get(selectedPublicLine) ?? []

        // If any variant is circular, don't show direction
        return !variants.some((v) => v.isCircular)
    }, [selectedPublicLine, linesByPublicName])

    if (lines === undefined || stations === undefined) return null

    const isDisabled = !isValid || isPending

    const close = () => {
        sheetRef.current?.close()

        setLineType('u')
        setSelectedPublicLine(null)
    }

    const onSubmit = async () => {
        if (!isValid) return

        const duration = Math.floor((Date.now() - (openedAt.current ?? 0)) / 1000)

        // Resolve the actual line variant ID to submit
        const lineId = resolveLineVariantForSubmit(
            selectedPublicLine,
            selectedStation,
            selectedDirection,
            linesByPublicName
        )

        const data = {
            stationId: selectedStation,
            lineId,
            directionId: selectedDirection,
        }

        track({
            name: 'Report Submitted',
            duration,
            stationId: data.stationId,
            line: lineId, // Use lineId as the line tracking value
            directionId: data.directionId ?? '',
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
                            options={publicLineOptions}
                            selectedOption={selectedPublicLine}
                            onSelect={(line) => setSelectedPublicLine(line)}
                            containerProps={{ py: 'xs', px: 'xs' }}
                            renderOption={(line) => <FFLineTag line={line} textProps={{ variant: 'header1' }} />}
                        />
                    </ScrollView>
                </FFView>
                {selectedPublicLine !== null && shouldShowDirection && (
                    <>
                        <FFText variant="header2" fontWeight="bold" color="fg" mt="xs" mb="xxs">
                            {tCommon('direction')}
                        </FFText>
                        <FFCarousellSelect
                            vertical
                            options={directionOptions}
                            selectedOption={selectedDirection}
                            onSelect={(direction) => setSelectedDirection(direction)}
                            containerProps={{
                                py: 'xs',
                                px: 'xs',
                                justifyContent: 'flex-start',
                            }}
                            renderOption={(direction, isSelected) => (
                                <FFView flexDirection="row">
                                    <FFText fontWeight={isSelected ? 'bold' : undefined}>
                                        {stations?.[direction]?.name ?? '?'}
                                    </FFText>
                                </FFView>
                            )}
                        />
                    </>
                )}
                {selectedPublicLine !== null && (
                    <>
                        <FFText variant="header2" fontWeight="bold" mt="xs" mb="xxs">
                            {tCommon('station')}
                        </FFText>
                        <FFCarousellSelect
                            vertical
                            collapses
                            options={stationOptions}
                            selectedOption={selectedStation}
                            onSelect={(station) => setSelectedStation(station)}
                            containerProps={{
                                py: 'xs',
                                px: 'xs',
                                justifyContent: 'flex-start',
                            }}
                            renderOption={(station, isSelected) => (
                                <FFView flexDirection="row" alignSelf="flex-start">
                                    <FFText fontWeight={isSelected ? 'bold' : undefined}>
                                        {stations?.[station]?.name ?? '?'}
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
