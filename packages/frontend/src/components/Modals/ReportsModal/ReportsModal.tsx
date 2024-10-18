import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import './ReportsModal.css'

interface ReportsModalProps {
    className?: string
}

type TabType = 'summary' | 'lines' | 'stations'

const ReportsModal: React.FC<ReportsModalProps> = ({ className }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')

    const tabs: TabType[] = ['summary', 'lines', 'stations']

    const handleTabChange = (tab: TabType) => {
        setCurrentTab(tab)
    }

    return (
        <div className={`reports-modal modal container ${className}`}>
            <section className="align-child-on-line">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={currentTab === tab ? 'active' : ''}
                    >
                        <h3>{t(`ReportsModal.${tab}`)}</h3>
                    </button>
                ))}
            </section>
        </div>
    )
}

export default ReportsModal
