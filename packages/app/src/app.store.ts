import { create } from 'zustand'

import { Report } from './api'

type AppState = {
    layer: 'risk' | 'lines'
    reportToShow: Report | null
    update: (update: Partial<AppState>) => void
}

export const useAppStore = create<AppState>((set) => ({
    layer: 'lines' as const,
    reportToShow: null,
    update: (update) => set((state) => ({ ...state, ...update })),
}))
