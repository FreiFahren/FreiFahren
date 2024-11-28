import './StatsPopUp.css'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface StatsPopUpProps {
    className: string
    numberOfReports: number
    openListModal: () => void
}

export const StatsPopUp = ({ className, numberOfReports, openListModal }: StatsPopUpProps) => {
    const { t } = useTranslation()
    const [message, setMessage] = useState(
        `<p><strong>${numberOfReports} ${t('StatsPopUp.reports')}</strong><br /> ${t('StatsPopUp.todayInBerlin')}</p>`
    )
    const [popOut, setPopOut] = useState(false)
    const [isVisible, setIsVisible] = useState(true)

    const timeForOneMessage = 3.5 * 1000
    const timeForPopOutAnimation = 0.5 * 1000

    const updateMessageAndShowPopup = useCallback(async () => {
        setMessage(
            `<p>${t('StatsPopUp.over')} <strong> 27.000 ${t('StatsPopUp.reporters')}</strong><br /> ${t(
                'StatsPopUp.inBerlin'
            )}</p>`
        )
        setPopOut(true)
    }, [t])

    const hidePopupAfterAnimation = useCallback(() => {
        setTimeout(() => {
            setPopOut(false)
            setTimeout(() => setIsVisible(false), timeForOneMessage)
        }, timeForPopOutAnimation)
    }, [timeForOneMessage, timeForPopOutAnimation])

    useEffect(() => {
        const timer = setTimeout(() => {
            // eslint-disable-next-line no-console
            updateMessageAndShowPopup().then(hidePopupAfterAnimation).catch(console.error)
        }, timeForOneMessage)

        return () => clearTimeout(timer)
    }, [hidePopupAfterAnimation, timeForOneMessage, updateMessageAndShowPopup])

    useEffect(() => {
        if (popOut) {
            const timer = setTimeout(() => setPopOut(false), timeForPopOutAnimation)

            return () => clearTimeout(timer)
        }
        return undefined
    }, [popOut, timeForPopOutAnimation])

    return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
            className={`
        stats-popup center-child ${className}
        ${popOut ? 'pop-out' : ''}
        ${!isVisible ? 'fade-out' : ''}`}
            onClick={openListModal}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: message }}
        />
    )
}
