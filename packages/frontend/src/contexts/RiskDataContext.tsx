import React, { createContext, useState, useContext, useCallback } from 'react'
import { RiskData } from 'src/utils/types'
import { isEqual } from 'lodash'

const defaultRefreshRiskData = async (): Promise<void> => {
    throw new Error('refreshRiskData is not implemented')
}

const RiskDataContext = createContext({
    segmentRiskData: null as RiskData | null,
    refreshRiskData: defaultRefreshRiskData,
})

export const useRiskData = () => useContext(RiskDataContext)

export const RiskDataProvider = ({ children }: { children: React.ReactNode }) => {
    const [segmentRiskData, setSegmentRiskData] = useState<RiskData | null>(null)

    const refreshRiskData = useCallback(async () => {
        try {
            const results = await fetch(`${process.env.REACT_APP_API_URL}/risk-prediction/segment-colors`)
            if (!results.ok) {
                throw new Error('Failed to fetch risk data')
            }
            const newData = await results.json()

            // Only update state if the data has actually changed
            if (!isEqual(newData, segmentRiskData)) {
                setSegmentRiskData(newData)
            }
        } catch (error) {
            console.error('Failed to fetch risk data:', error)
            setSegmentRiskData(null)
        }
    }, [segmentRiskData])

    return <RiskDataContext.Provider value={{ segmentRiskData, refreshRiskData }}>{children}</RiskDataContext.Provider>
}
