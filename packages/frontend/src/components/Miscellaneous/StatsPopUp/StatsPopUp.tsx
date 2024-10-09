import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import './StatsPopUp.css'

interface StatsPopUpProps {
    className: string
    numberOfReports: number
    openListModal: () => void
}

const StatsPopUp: React.FC<StatsPopUpProps> = ({ className, numberOfReports, openListModal }) => {
    const { t } = useTranslation()
    const [message, setMessage] = useState(
        `<p><strong>${numberOfReports} ${t('StatsPopUp.reports')}</strong><br /> ${t('StatsPopUp.todayInBerlin')}</p>`
    )
    const [popOut, setPopOut] = useState(false)
    const [isVisible, setIsVisible] = useState(true)

    const timeForOneMessage = 3.5 * 1000
    const timeForPopOutAnimation = 0.5 * 1000

    const updateMessageAndShowPopup = async () => {
        setMessage(
            `<p>${t('StatsPopUp.over')} <strong> 27.000 ${t('StatsPopUp.reporters')}</strong><br /> ${t(
                'StatsPopUp.inBerlin'
            )}</p>`
        )
        setPopOut(true)
    }

    const hidePopupAfterAnimation = useCallback(() => {
        setTimeout(() => {
            setPopOut(false)
            setTimeout(() => setIsVisible(false), timeForOneMessage)
        }, timeForPopOutAnimation)
    }, [timeForOneMessage, timeForPopOutAnimation])

    useEffect(() => {
        const timer = setTimeout(() => {
            updateMessageAndShowPopup().then(hidePopupAfterAnimation)
        }, timeForOneMessage)

        return () => clearTimeout(timer)
    }, [hidePopupAfterAnimation, timeForOneMessage])

    useEffect(() => {
        if (popOut) {
            const timer = setTimeout(() => setPopOut(false), timeForPopOutAnimation)
            return () => clearTimeout(timer)
        }
    }, [popOut, timeForPopOutAnimation])

    return (
        <div
            className={`
        stats-popup center-child ${className}
        ${popOut ? 'pop-out' : ''}
        ${!isVisible ? 'fade-out' : ''}`}
            onClick={openListModal}
            dangerouslySetInnerHTML={{ __html: message }}
        />
    )
}

export default StatsPopUp
