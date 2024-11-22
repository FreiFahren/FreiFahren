import AsyncStorage from '@react-native-async-storage/async-storage'
import { pick } from 'lodash'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { Report } from './api'

const PERSISTED_KEYS = ['layer', 'dismissedDisclaimerAt', 'privacyPolicyVersion'] as const

type AppState = {
    layer: 'risk' | 'lines'
    reportToShow: Report | null
    dismissedDisclaimerAt: string | null
    privacyPolicyVersion: number | null
    appLocked: boolean
    update: (update: Partial<AppState>) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            layer: 'lines' as const,
            reportToShow: null,
            dismissedDisclaimerAt: null,
            privacyPolicyVersion: null,
            appLocked: true,
            update: (update) => set((state) => ({ ...state, ...update })),
        }),
        {
            name: 'app-store',
            getStorage: () => AsyncStorage,
            partialize: (state) => pick(state, PERSISTED_KEYS),
        }
    )
)
