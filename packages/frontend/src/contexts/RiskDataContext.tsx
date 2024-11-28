import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { RiskData } from 'src/utils/types'

import { getRecentDataWithIfModifiedSince } from '../utils/databaseUtils'

const defaultRefreshRiskData = async (): Promise<void> => {
    throw new Error('refreshRiskData is not implemented')
}

const RiskDataContext = createContext({
    segmentRiskData: null as RiskData | null,
    refreshRiskData: defaultRefreshRiskData,
    lastModified: null as Date | null,
})

export const useRiskData = () => useContext(RiskDataContext)

export const RiskDataProvider = ({ children }: { children: React.ReactNode }) => {
    const [segmentRiskData, setSegmentRiskData] = useState<RiskData | null>(null)
    const [lastModified, setLastModified] = useState<Date | null>(null)

    const refreshRiskData = useCallback(async () => {
        try {
            const results = await getRecentDataWithIfModifiedSince(
                `${process.env.REACT_APP_API_URL}/risk-prediction/segment-colors`,
                lastModified
            )

            if (results !== null) {
                setSegmentRiskData(results)
                setLastModified(new Date(results.last_modified))
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch risk data:', error)
            setSegmentRiskData(null)
        }
    }, [lastModified])

    const context = useMemo(() => ({ segmentRiskData, refreshRiskData, lastModified }), [segmentRiskData, refreshRiskData, lastModified])

    return (
        <RiskDataContext.Provider value={context}>
            {children}
        </RiskDataContext.Provider>
    )
}
