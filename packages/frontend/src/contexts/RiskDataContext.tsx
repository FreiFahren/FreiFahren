import React, { createContext, useState, useContext } from 'react';
import { getRecentDataWithIfModifiedSince } from '../utils/dbUtils';
import { RiskData } from 'src/utils/types';

const RiskDataContext = createContext<{ segmentRiskData: RiskData | null, refreshRiskData: () => void }>({ segmentRiskData: null, refreshRiskData: () => {} });

export const useRiskData = () => useContext(RiskDataContext);

export const RiskDataProvider = ({ children }: { children: React.ReactNode }) => {
    const [segmentRiskData, setSegmentRiskData] = useState<RiskData | null>(null);

    const refreshRiskData = async () => {
        const results: RiskData = await getRecentDataWithIfModifiedSince(`${process.env.REACT_APP_API_URL}/risk-prediction/getSegmentColors`, null);
        setSegmentRiskData(results);
        console.log('Risk data refreshed');
    };

    return (
        <RiskDataContext.Provider value={{ segmentRiskData, refreshRiskData }}>
            {children}
        </RiskDataContext.Provider>
    );
};
