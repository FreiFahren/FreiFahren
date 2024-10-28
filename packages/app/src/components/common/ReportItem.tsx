import { isNil } from 'lodash'
import { Row, Text, View } from 'native-base'
import { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Report } from '../../api'
import { stations } from '../../data'
import { formatTime } from '../../util/formatTime'
import { FFLineTag } from './FFLineTag'

type ReportItemProps = {
    report: Report
} & ComponentProps<typeof View>

export const ReportItem = ({ report, ...props }: ReportItemProps) => {
    const { t } = useTranslation('reportDetails')
    const station = stations[report.stationId]

    return (
        <View {...props}>
            <Row space={2} alignItems="center">
                <FFLineTag line={report.line} />
                <Text color="white" bold>
                    {station.name}
                </Text>
            </Row>
            <Row space={2} mt={1}>
                <Text color="fg">
                    {formatTime(report.timestamp, t)}
                    {`, ${t('direction')} `}
                    {isNil(report.direction?.name) ? (
                        t('unknownDirection')
                    ) : (
                        <Text color="white">{report.direction.name}</Text>
                    )}
                </Text>
            </Row>
        </View>
    )
}
