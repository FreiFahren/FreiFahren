import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { DateTime, Duration } from 'luxon'
import { useEffect, useRef, useState } from 'react'

import { usePrivacyPolicyMeta } from '../../api/queries'
import { useAppStore } from '../../app.store'
import { useTracking } from '../../tracking/provider'
import { Disclaimer } from './Disclaimer'
import { PrivacyPolicyUpdate } from './PrivacyPolicyUpdate'

const DISCLAIMER_INTERVAL = Duration.fromObject({ days: 7 })

const useShouldShowDisclaimer = () => {
    const [shouldShowDisclaimer, setShouldShowDisclaimer] = useState<boolean | undefined>(true)

    const dismissedDisclaimerAt = useAppStore((state) => state.dismissedDisclaimerAt)

    useEffect(() => {
        if (dismissedDisclaimerAt !== null) {
            const now = DateTime.now()
            const dismissedAtDate = DateTime.fromISO(dismissedDisclaimerAt)

            if (Math.abs(now.diff(dismissedAtDate).as('days')) <= DISCLAIMER_INTERVAL.as('days')) {
                setShouldShowDisclaimer(false)
                return
            }
        }
        setShouldShowDisclaimer(true)
    }, [dismissedDisclaimerAt])

    return shouldShowDisclaimer
}

const useShouldShowPrivacyPolicy = (newestPrivacyPolicyVersion: number | undefined) => {
    const [shouldShowPrivacyPolicy, setShouldShowPrivacyPolicy] = useState<undefined | boolean>(undefined)

    const acceptedPrivacyPolicy = useAppStore(({ privacyPolicyVersion }) => privacyPolicyVersion)

    useEffect(() => {
        if (newestPrivacyPolicyVersion === undefined) return

        if (acceptedPrivacyPolicy === null || newestPrivacyPolicyVersion > acceptedPrivacyPolicy) {
            setShouldShowPrivacyPolicy(true)
        } else {
            setShouldShowPrivacyPolicy(false)
        }
    }, [acceptedPrivacyPolicy, newestPrivacyPolicyVersion])

    return shouldShowPrivacyPolicy
}

export const Blocker = () => {
    const sheetRef = useRef<BottomSheetModal>(null)
    const { track } = useTracking()

    const updateStore = useAppStore(({ update }) => update)

    const newestPrivacyPolicyVersion = usePrivacyPolicyMeta().data?.version

    const shouldShowDisclaimer = useShouldShowDisclaimer()
    const shouldShowPrivacyPolicy = useShouldShowPrivacyPolicy(newestPrivacyPolicyVersion)

    useEffect(() => {
        if (shouldShowDisclaimer === true) {
            sheetRef.current?.present()
            track({ name: 'Disclaimer Viewed' })
        } else if (shouldShowDisclaimer === false && shouldShowPrivacyPolicy === true) {
            sheetRef.current?.present()
            track({ name: 'Privacy Policy Blocker Shown' })
        } else if (shouldShowDisclaimer === false && shouldShowPrivacyPolicy === false) {
            sheetRef.current?.dismiss()
            updateStore({ appLocked: false })
        }
    }, [shouldShowDisclaimer, shouldShowPrivacyPolicy, updateStore, track])

    const onDismissDisclaimer = () => {
        sheetRef.current?.dismiss()
        updateStore({ dismissedDisclaimerAt: DateTime.now().toISO(), privacyPolicyVersion: newestPrivacyPolicyVersion })
        track({ name: 'Disclaimer Dismissed' })
    }

    const onDismissPrivacyPolicy = () => {
        sheetRef.current?.dismiss()
        updateStore({ privacyPolicyVersion: newestPrivacyPolicyVersion })
        track({ name: 'Privacy Policy Accepted' })
    }

    if (shouldShowDisclaimer === true) {
        return <Disclaimer onDismiss={onDismissDisclaimer} ref={sheetRef} />
    }
    if (shouldShowPrivacyPolicy === true) {
        return <PrivacyPolicyUpdate onDismiss={onDismissPrivacyPolicy} ref={sheetRef} />
    }

    return null
}
