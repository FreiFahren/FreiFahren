import React from 'react'
import { useTranslation } from 'react-i18next'

import './ReportsModal.css'

interface ReportsModalProps {
    className?: string
}

const ReportsModal: React.FC<ReportsModalProps> = ({ className }) => {
    const { t } = useTranslation()
    return (
        <div className={`reports-modal modal container ${className}`}>
            <section className="align-child-on-line">
                <button>
                    <h3>{t('ReportsModal.summary')}</h3>
                </button>
                <button>
                    <h3>{t('ReportsModal.lines')}</h3>
                </button>
                <button>
                    <h3>{t('ReportsModal.stations')}</h3>
                </button>
            </section>
        </div>
    )
}

export default ReportsModal
