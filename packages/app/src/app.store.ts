import AsyncStorage from '@react-native-async-storage/async-storage'
import { pick } from 'lodash'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { type Report } from './api'

const PERSISTED_KEYS = ['layer', 'dismissedDisclaimerAt', 'privacyPolicyVersion', 'language'] as const

type AppState = {
    layer: 'risk' | 'lines'
    reportToShow: Report | null
    dismissedDisclaimerAt: string | null
    privacyPolicyVersion: number | null
    appLocked: boolean
    language: string | null
    deprecated: boolean | null
    update: (update: Partial<AppState>) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            layer: 'lines',
            reportToShow: null,
            dismissedDisclaimerAt: null,
            privacyPolicyVersion: null,
            appLocked: true,
            language: null,
            deprecated: null,
            update: (update) => set((state) => ({ ...state, ...update })),
        }),
        {
            name: 'app-store',
            getStorage: () => AsyncStorage,
            partialize: (state) => pick(state, PERSISTED_KEYS),
        }
    )
)
