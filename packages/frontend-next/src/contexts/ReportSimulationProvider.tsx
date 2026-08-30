import { type ReactNode, useState } from 'react';

import {
  ReportSimulationContext,
  type ReportSimulationContextValue,
  type ReportSimulationState,
} from './ReportSimulation.context';

const INITIAL_STATE: ReportSimulationState = { reports: null, nowMs: null };

export function ReportSimulationProvider({ children }: { children: ReactNode }) {
  const [state, setSimulation] = useState<ReportSimulationState>(INITIAL_STATE);

  const value: ReportSimulationContextValue = {
    ...state,
    setSimulation,
  };

  return <ReportSimulationContext value={value}>{children}</ReportSimulationContext>;
}
