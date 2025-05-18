import { useShouldShowLegalDisclaimer } from './useShouldShowLegalDisclaimer'
import { useShouldShowMarketingModal } from './useShouldShowMarketingModal'

export interface TimedModalsVisibility {
    shouldShowLegalDisclaimer: boolean
    shouldShowMarketingModal: boolean
    canShowStatsPopUp: boolean
}

export interface TimedModalsActions {
    acceptLegalDisclaimer: () => void
    dismissMarketingModal: () => void
}

export interface UseTimedModalsProps {
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
        finalCanShowStatsPopUp = true

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
