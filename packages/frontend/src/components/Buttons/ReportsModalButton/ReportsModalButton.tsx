import './ReportsModalButton.css'

import { useTranslation } from 'react-i18next'
import { sendAnalyticsEvent } from 'src/utils/analytics'

interface ReportsModalButtonProps {
    openModal: () => void
}

export const ReportsModalButton = ({ openModal }: ReportsModalButtonProps) => {
    const { t } = useTranslation()

    const handleClick = () => {
        openModal()

        sendAnalyticsEvent('ReportsModal opened', {})
    }

    return (
        // eslint-disable-next-line react/button-has-type
        <button className="list-button small-button align-child-on-line" onClick={handleClick}>
            <img className="svg" src={`${process.env.PUBLIC_URL}/icons/list.svg`} alt="list button" />
            <p>{t('InspectorListButton.label')}</p>
        </button>
    )
}
