import { Entypo } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { groupBy } from 'lodash'
import { Stack, Text, View } from 'native-base'
import { ComponentProps, forwardRef, PropsWithChildren, Ref, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutAnimation } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'

import { Report, useReports } from '../../../api'
import { stations } from '../../../data'
import { formatTime } from '../../../util/formatTime'
import { FFButton } from '../../common/FFButton'
import { FFCarousellSelect } from '../../common/FFCarousellSelect'
import { FFLineTag } from '../../common/FFLineTag'
import { FFScrollSheet } from '../../common/FFSheet'
import { FFSpinner } from '../../common/FFSpinner'
import { ReportItem } from '../../common/ReportItem'

type TopLineItemProps = {
    line: string
    direction: string
    reports: Report[]
} & ComponentProps<typeof View>

const TopLineItem = ({ line, direction, reports, ...props }: TopLineItemProps) => {
    const { t } = useTranslation('reportDetails')
    const [isExpanded, setIsExpanded] = useState(false)

    const mostRecentTime = formatTime(reports[0].timestamp, t)

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setIsExpanded(!isExpanded)
    }

    return (
        <View {...props}>
            <View flexDir="row" justifyContent="space-between" alignItems="center">
                <View flexDir="row">
                    <FFLineTag line={line} />
                    <Text bold fontSize="xl">
                        {stations[direction].name}
                    </Text>
                </View>
                <View flexDir="row">
                    <Text>{mostRecentTime}</Text>
                    <FFButton onPress={toggleExpanded}>
                        <Entypo name={isExpanded ? 'chevron-up' : 'chevron-down'} size={22} color="white" />
                    </FFButton>
                </View>
            </View>
            {isExpanded && (
                <Stack mt={2}>
                    {reports.map((report, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <View mt="4" ml="4" key={index}>
                            <Text>{stations[report.stationId].name}</Text>
                        </View>
                    ))}
                </Stack>
            )}
        </View>
    )
}

export const OverviewSheet = forwardRef((_props: PropsWithChildren<{}>, ref: Ref<BottomSheetModalMethods>) => {
    const { t } = useTranslation('reportList')
    const { data: reports } = useReports()

    const [linesWithReports, reportsByLine] = useMemo(() => {
        const byLine = groupBy(reports, 'line')

        const entries = Object.entries(byLine).sort(
            ([_lineA, reportsForLineA], [_lineB, reportsForLineB]) => reportsForLineB.length - reportsForLineA.length
        )

        return [entries.map(([line]) => (line === 'null' ? null : line)), Object.fromEntries(entries)]
    }, [reports])

    const [filteredLine, setFilteredLine] = useState<string | null>(null)

    const filteredReports = useMemo(
        () => (filteredLine === null ? reports : reportsByLine[filteredLine.toString()]) ?? [],
        [filteredLine, reports, reportsByLine]
    )

    return (
        <FFScrollSheet ref={ref}>
            <Text fontSize="xl" color="white" bold>
                {t('title')}
            </Text>
            {reports?.length === 0 ? (
                <Text color="fg">{t('empty')}</Text>
            ) : reports === undefined ? (
                <View flex={1}>
                    <FFSpinner />
                </View>
            ) : (
                <View mt={4}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <FFCarousellSelect
                            options={linesWithReports}
                            selectedOption={filteredLine}
                            onSelect={(line) => setFilteredLine(line)}
                            containerProps={{ py: 3, px: 4 }}
                            renderOption={(line) => <FFLineTag line={line} textProps={{ fontSize: '2xl' }} />}
                        />
                    </ScrollView>
                    <Stack pb={12}>
                        {filteredReports.map((report, index) => (
                            <ReportItem
                                key={`${report.stationId}-${report.timestamp.getMilliseconds()}`}
                                report={report}
                                py={3}
                                pt={index === 0 ? 0 : undefined}
                                borderTopWidth={index === 0 ? 0 : 1}
                                borderColor="bg2"
                            />
                        ))}
                    </Stack>
                </View>
            )}
        </FFScrollSheet>
    )
})
