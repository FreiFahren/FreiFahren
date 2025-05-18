import { useShouldShowLegalDisclaimer } from './useShouldShowLegalDisclaimer'
import { useShouldShowMarketingModal } from './useShouldShowMarketingModal'

/**
 * Describes the visibility state of timed modals.
 */
export interface TimedModalsVisibility {
    /** Whether the Legal Disclaimer modal should be shown. */
    shouldShowLegalDisclaimer: boolean
    /** Whether the Marketing Modal should be shown, considering its own rules, legal disclaimer status, and non-timed modal status. */
    shouldShowMarketingModal: boolean
    /** Indicates if conditions (primarily legal disclaimer being handled) allow StatsPopUp to be considered for display. */
    canShowStatsPopUp: boolean
}

/**
 * Defines actions that can be performed on timed modals.
 */
export interface TimedModalsActions {
    /** Action to accept the legal disclaimer. */
    acceptLegalDisclaimer: () => void
    /** Action to dismiss the marketing modal. */
    dismissMarketingModal: () => void
}

/**
 * Props for the useTimedModals hook.
 */
export interface UseTimedModalsProps {
    /** Indicates if any non-timed modal is currently open. */
    isNonTimedModalOpen: boolean
}

/**
 * Custom hook to manage and coordinate the visibility of timed modals
 * such as Legal Disclaimer, Marketing Modal, and StatsPopUp.
 * It enforces display rules, like Legal Disclaimer having top priority,
 * and Marketing Modal only appearing when no other non-timed modals are active.
 *
 * @param props - Props for the hook, including the status of non-timed modals.
 * @returns A tuple containing the visibility states of timed modals and actions to interact with them.
 */
export const useTimedModals = ({
    isNonTimedModalOpen,
}: UseTimedModalsProps): [TimedModalsVisibility, TimedModalsActions] => {
    const [isLegalDisclaimerDueByOwnRules, acceptLegalDisclaimerAction] = useShouldShowLegalDisclaimer()

    const [isMarketingModalDueByOwnRules, dismissMarketingModalAction] = useShouldShowMarketingModal()

    let finalShouldShowLegalDisclaimer = isLegalDisclaimerDueByOwnRules
    let finalShouldShowMarketingModal = false
    let finalCanShowStatsPopUp = false

    if (finalShouldShowLegalDisclaimer) {
        // Legal disclaimer is active, so other timed modals must wait.
        finalShouldShowMarketingModal = false
        finalCanShowStatsPopUp = false
    } else {
        // Legal disclaimer is not active (i.e., it has been handled or was never due to be shown).
        // Conditions are met for StatsPopUp to be considered.
        finalCanShowStatsPopUp = true

        // Marketing modal can be considered if:
        // 1. Its own timing and dismissal rules are met (`isMarketingModalDueByOwnRules`).
        // 2. No non-timed modal is currently open (`!isNonTimedModalOpen`).
        // (The condition that Legal Disclaimer is handled is implicit by being in this 'else' block)
        if (isMarketingModalDueByOwnRules && !isNonTimedModalOpen) {
            finalShouldShowMarketingModal = true
        }
    }

    const visibility: TimedModalsVisibility = {
        shouldShowLegalDisclaimer: finalShouldShowLegalDisclaimer,
        shouldShowMarketingModal: finalShouldShowMarketingModal,
        canShowStatsPopUp: finalCanShowStatsPopUp,
    }

    const actions: TimedModalsActions = {
        acceptLegalDisclaimer: acceptLegalDisclaimerAction,
        dismissMarketingModal: dismissMarketingModalAction,
    }

    return [visibility, actions]
}
