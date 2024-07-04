import React, { createContext, useState, useContext, useCallback } from 'react';
import { getRecentDataWithIfModifiedSince } from '../utils/dbUtils';
import { RiskData } from 'src/utils/types';

const defaultRefreshRiskData = async (): Promise<void> => {
    throw new Error('refreshRiskData is not implemented');
};

const RiskDataContext = createContext({
    segmentRiskData: null as RiskData | null,
    refreshRiskData: defaultRefreshRiskData,
    lastModified: null as string | null
});

export const useRiskData = () => useContext(RiskDataContext);

export const RiskDataProvider = ({ children }: { children: React.ReactNode }) => {
    const [segmentRiskData, setSegmentRiskData] = useState<RiskData | null>(null);
    const [lastModified, setLastModified] = useState<string | null>(null);

    const refreshRiskData = useCallback(async () => {
        try {
            const results = await getRecentDataWithIfModifiedSince(
                `${process.env.REACT_APP_API_URL}/risk-prediction/getSegmentColors`,
                lastModified
            );
            if (results) {
                setSegmentRiskData(results);
                setLastModified(results.last_modified);
            }
        } catch (error) {
            console.error('Failed to fetch risk data:', error);
            setSegmentRiskData(null);
        }
    }, [lastModified]);

    return (
        <RiskDataContext.Provider value={{ segmentRiskData, refreshRiskData, lastModified }}>
            {children}
        </RiskDataContext.Provider>
    );
};
