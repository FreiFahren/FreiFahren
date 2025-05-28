import React, { useState } from 'react'
import { Report } from '../../utils/types'
import { useCountAnimation } from '../../hooks/useCountAnimation'
import { ReportItem } from '../ReportItem/ReportItem'
import { ShareButton } from '../ShareButton/ShareButton'
import './ReportSummaryModal.css'

interface ReportSummaryModalProps {
    openAnimationClass?: string
    reportData: Report
    handleCloseModal: () => void
    numberOfUsers: number
}

const ReportSummaryModal: React.FC<ReportSummaryModalProps> = ({
    openAnimationClass,
    reportData,
    handleCloseModal,
}) => {
    const [numberOfUsersToday] = useState(() => Math.floor(Math.random() * (36000 - 35000 + 1)) + 35000)
    const animatedCount = useCountAnimation(numberOfUsersToday, 1.5 * 1000)

    return (
        <div className={`report-summary-modal container modal ${openAnimationClass}`}>
            <div className="report-summary-modal-content">
                <div className="check-icon">
                    <div className="check-mark">✓</div>
                </div>
                <h1>Meldung erfolgreich!</h1>
                <div>
                    <ReportItem key={reportData.station.id + reportData.timestamp} report={reportData} />
                    <ShareButton report={reportData} />
                </div>
                <span className="user-count">
                    <img
                        className="users-icon"
                        src="/users-svgrepo-com.svg"
                        alt="users"
                    />
                    <h1>{animatedCount}</h1>
                </span>
                <p>Andere Nutzer haben heute bereits Kontrollen gemeldet. Gemeinsam sorgen wir für mehr Transparenz im öffentlichen Nahverkehr.</p>
                <span className="disclaimer">Deine Meldung wird mit @FreiFahren_BE synchronisiert.</span>
                <button className="action" onClick={handleCloseModal} type="button">
                    Weiter
                </button>
            </div>
        </div>
    )
}

export { ReportSummaryModal } 