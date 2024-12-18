import './StatsPopUp.css'

import React, { useCallback,useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface StatsPopUpProps {
    className: string
    numberOfReports: number
    openListModal: () => void
    numberOfUsers: number
}

const StatsPopUp: React.FC<StatsPopUpProps> = ({ className, numberOfReports, openListModal, numberOfUsers }) => {
    const { t } = useTranslation()
    const [message, setMessage] = useState(
        `<p><strong>${numberOfReports} ${t('StatsPopUp.reports')}</strong><br /> ${t('StatsPopUp.todayInBerlin')}</p>`
    )
    const [popOut, setPopOut] = useState(false)
    const [isVisible, setIsVisible] = useState(true)

    const timeForOneMessage = 3.5 * 1000
    const timeForPopOutAnimation = 0.5 * 1000

    const hidePopupAfterAnimation = useCallback(() => {
        setTimeout(() => {
            setPopOut(false)
            setTimeout(() => setIsVisible(false), timeForOneMessage)
        }, timeForPopOutAnimation)
    }, [timeForOneMessage, timeForPopOutAnimation])

    useEffect(() => {
        const updateMessageAndShowPopup = async () => {
            setMessage(
                `<p>${t('StatsPopUp.over')} <strong> ${numberOfUsers} ${t('StatsPopUp.reporters')}</strong><br /> ${t(
                    'StatsPopUp.inBerlin'
                )}</p>`
            )
            setPopOut(true)
        }

        const timer = setTimeout(() => {
            updateMessageAndShowPopup().then(hidePopupAfterAnimation).catch(error => {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error('Error updating message and showing popup:', error)
            })
        }, timeForOneMessage)

        return () => clearTimeout(timer)
    }, [hidePopupAfterAnimation, timeForOneMessage, numberOfUsers, t])

    // eslint-disable-next-line consistent-return
    useEffect(() => {
        if (popOut) {
            const timer = setTimeout(() => setPopOut(false), timeForPopOutAnimation)

            return () => clearTimeout(timer)
        }
    }, [popOut, timeForPopOutAnimation])

    return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
            className={`
        stats-popup center-child ${className}
        ${popOut ? 'pop-out' : ''}
        ${!isVisible ? 'fade-out' : ''}`}
            // eslint-disable-next-line react/jsx-handler-names
            onClick={openListModal}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: message }}
        />
    )
}

export { StatsPopUp }
