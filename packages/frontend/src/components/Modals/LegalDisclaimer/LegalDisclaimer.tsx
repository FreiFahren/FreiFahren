import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CenterModal } from '../CenterModal'
import { SubmitButton } from '../../common/SubmitButton/SubmitButton'

interface LegalDisclaimerProps {
    handleConfirm: () => void
}

const LegalDisclaimer: React.FC<LegalDisclaimerProps> = ({ handleConfirm }) => {
    const { t } = useTranslation()

    return (
        <CenterModal animationType="popup" className="flex max-h-[85vh] flex-col justify-between">
            <div className="flex-1 overflow-y-auto">
                <h1 className="mb-4 text-xl font-bold">{t('LegalDisclaimer.title')}</h1>
                <section>
                    <p className="mb-4">{t('LegalDisclaimer.text')}</p>
                    <ol className="mb-4 list-inside list-decimal space-y-4">
                        <li className="text-left marker:text-gray-500">
                            <strong className="font-semibold">{t('LegalDisclaimer.ticket')}</strong>
                            <p className="mt-1 text-sm">{t('LegalDisclaimer.ticketDescription')}</p>
                        </li>
                        <li className="text-left marker:text-gray-500">
                            <strong className="font-semibold">{t('LegalDisclaimer.activeUsage')}</strong>
                            <p className="mt-1 text-sm">{t('LegalDisclaimer.activeUsageDescription')}</p>
                        </li>
                    </ol>
                    <p className="mb-4">{t('LegalDisclaimer.saved')}</p>
                </section>
            </div>
            <div className="mt-4 flex flex-shrink-0 flex-col items-stretch">
                <SubmitButton isValid={true} onClick={handleConfirm} className="mb-4">
                    {t('LegalDisclaimer.confirm')}
                </SubmitButton>
                <ul className="flex justify-end">
                    <li className="ml-2 text-xs">
                        <Link to="/Datenschutz" className="text-gray-500 underline">
                            {t('LegalDisclaimer.privacy')}
                        </Link>
                    </li>
                </ul>
            </div>
        </CenterModal>
    )
}

export { LegalDisclaimer }
