import React from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from 'recharts'
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { getLineColor } from 'src/utils/uiUtils'

interface LinesSectionProps {
    getChartData: { line: string; reports: number }[]
}

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
    getChartData: { line: string; reports: number }[]
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, getChartData }) => {
    const { t } = useTranslation()

    if (!(active ?? false) || !payload || payload.length === 0) return null

    const data = payload[0].payload
    const totalReports = getChartData.reduce((sum, item) => sum + item.reports, 0)
    const percentage = ((data.reports / totalReports) * 100).toFixed(1)

    return (
        <div
            className="custom-tooltip"
            style={{
                backgroundColor: '#000',
                color: '#fff',
                padding: '8px',
                borderRadius: '4px',
            }}
        >
            <h4>{`${percentage}% ${t('ReportsModal.ofTotal')}`}</h4>
            <p>{`${data.reports} ${t('ReportsModal.reports')}`}</p>
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomBarShape = ({ x, y, width, height, payload }: any) => {
    const color = getLineColor(payload.line)
    return <rect x={x} y={y} width={width} height={height} fill={color} rx={4} ry={4} />
}

const LinesSection: React.FC<LinesSectionProps> = ({ getChartData }) => {
    const { t } = useTranslation()

    return (
        <section className="list-modal">
            <h2>{t('ReportsModal.topLines')}</h2>
            <p className="time-range">{t('ReportsModal.past24Hours')}</p>
            <ResponsiveContainer width="100%" height={getChartData.length * (34 + 12)}>
                <BarChart data={getChartData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="line"
                        width={40}
                        interval={0}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                            fontSize: 16,
                            fontWeight: 800,
                            fill: '#fff',
                            dx: -5,
                        }}
                    />
                    <Tooltip content={<CustomTooltip getChartData={getChartData} />} />
                    <Bar
                        dataKey="reports"
                        barSize={24}
                        radius={[4, 4, 4, 4]}
                        fill="#7e5330"
                        name="reports"
                        shape={CustomBarShape}
                    />
                </BarChart>
            </ResponsiveContainer>
        </section>
    )
}

export { LinesSection }
