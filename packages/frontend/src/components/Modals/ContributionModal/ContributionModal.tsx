import './ContributionModal.css'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloseButton from 'src/components/Buttons/CloseButton/CloseButton'

export const CONTRIBUTION_MODAL_DISMISSED_KEY = 'contributionModalDismissed'

const BANK_HOLDER = 'FreiFahren e.V.'
const BANK_IBAN = 'DE73 8306 5408 0007 0044 60'
const BANK_BIC = 'GENODEF1SLR'

interface ContributionModalProps {
    onClose: () => void
    onDismissPermanently: () => void
}

type BankFieldId = 'holder' | 'iban' | 'bic' | 'reference'

const stripeBuyButtonId = import.meta.env.VITE_STRIPE_BUY_BUTTON_ID
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const hasStripeConfig = stripeBuyButtonId !== '' && stripePublishableKey !== ''

const ContributionModal = ({ onClose, onDismissPermanently }: ContributionModalProps) => {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<'stripe' | 'bank'>(hasStripeConfig ? 'stripe' : 'bank')
    const [copiedFieldId, setCopiedFieldId] = useState<BankFieldId | null>(null)

    useEffect(() => {
        if (document.querySelector('script[src="https://js.stripe.com/v3/buy-button.js"]')) return

        const script = document.createElement('script')
        script.src = 'https://js.stripe.com/v3/buy-button.js'
        script.async = true
        document.head.appendChild(script)
    }, [])

    const handleDismissPermanently = () => {
        localStorage.setItem(CONTRIBUTION_MODAL_DISMISSED_KEY, 'true')
        onDismissPermanently()
    }

    const copyBankValue = async (fieldId: BankFieldId, value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedFieldId(fieldId)
            window.setTimeout(() => setCopiedFieldId(null), 2000)
        } catch {
            setCopiedFieldId(null)
        }
    }

    const bankReferenceValue = t('ContributionModal.bankReferenceValue')

    const copyAriaLabel = (rowLabel: string, fieldId: BankFieldId) =>
        copiedFieldId === fieldId
            ? `${t('ContributionModal.copied')}: ${rowLabel}`
            : `${t('ContributionModal.copy')}: ${rowLabel}`

    const bankRows: { id: BankFieldId; label: string; value: string }[] = [
        { id: 'holder', label: t('ContributionModal.bankHolder'), value: BANK_HOLDER },
        { id: 'iban', label: 'IBAN', value: BANK_IBAN },
        { id: 'bic', label: 'BIC', value: BANK_BIC },
        { id: 'reference', label: t('ContributionModal.bankReference'), value: bankReferenceValue },
    ]

    return (
        <div className="contribution-modal-shell block animate-popup">
            <CloseButton handleClose={onClose} />
            <div className="contribution-modal-panel">
                <div className="contribution-modal-content">
                    <h1>{t('ContributionModal.title')}</h1>
                    <p>{t('ContributionModal.description')}</p>
                    <div className="contribution-tabs">
                        {hasStripeConfig ? (
                            <button
                                type="button"
                                className={`contribution-tab ${activeTab === 'stripe' ? 'active' : ''}`}
                                onClick={() => setActiveTab('stripe')}
                            >
                                {t('ContributionModal.tabStripe')}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className={`contribution-tab ${activeTab === 'bank' ? 'active' : ''}`}
                            onClick={() => setActiveTab('bank')}
                        >
                            {t('ContributionModal.tabBank')}
                        </button>
                    </div>
                    {activeTab === 'stripe' && hasStripeConfig ? (
                        <div className="contribution-stripe">
                            <stripe-buy-button
                                buy-button-id={stripeBuyButtonId}
                                publishable-key={stripePublishableKey}
                            />
                        </div>
                    ) : null}
                    {activeTab === 'bank' ? (
                        <div className="contribution-bank">
                            {bankRows.map((row) => (
                                <div key={row.id} className="contribution-bank-row">
                                    <span className="contribution-bank-label">{row.label}</span>
                                    <div className="contribution-bank-value-group">
                                        <span className="contribution-bank-value">{row.value}</span>
                                        <button
                                            type="button"
                                            className={`contribution-copy-button${copiedFieldId === row.id ? ' contribution-copy-button--copied' : ''}`}
                                            onClick={() => copyBankValue(row.id, row.value)}
                                            aria-label={copyAriaLabel(row.label, row.id)}
                                        >
                                            {copiedFieldId === row.id ? (
                                                <img
                                                    src="/icons/risk-0.svg"
                                                    alt=""
                                                    className="contribution-copy-icon no-filter"
                                                />
                                            ) : (
                                                <img src="/icons/copy.svg" alt="" className="contribution-copy-icon" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <button type="button" className="contribution-dismiss" onClick={handleDismissPermanently}>
                        {t('ContributionModal.dismiss')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export { ContributionModal }
