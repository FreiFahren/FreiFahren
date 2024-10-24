import AsyncStorage from '@react-native-async-storage/async-storage'
import { pick } from 'lodash'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { Report } from './api'

const PERSISTED_KEYS = ['layer', 'dismissedDisclaimerAt'] as const

type AppState = {
    layer: 'risk' | 'lines'
    reportToShow: Report | null
    dismissedDisclaimerAt: string | null
    disclaimerGood: boolean
    update: (update: Partial<AppState>) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            layer: 'lines' as const,
            reportToShow: null,
            dismissedDisclaimerAt: null,
            disclaimerGood: false,
            update: (update) => set((state) => ({ ...state, ...update })),
        }),
        {
            name: 'app-store',
            getStorage: () => AsyncStorage,
            partialize: (state) => pick(state, PERSISTED_KEYS),
        }
    )
)
