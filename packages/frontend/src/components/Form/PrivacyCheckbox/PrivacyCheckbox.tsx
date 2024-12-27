import React, { FC } from 'react'
import { useTranslation } from 'react-i18next'
import './PrivacyCheckbox.css'

interface PrivacyCheckboxProps {
    isChecked: boolean
    onChange: (checked: boolean) => void
    id?: string
    className?: string
}

const PrivacyCheckbox: FC<PrivacyCheckboxProps> = ({ isChecked, onChange, id = 'privacy-checkbox', className }) => {
    const { t } = useTranslation()

    return (
        <label htmlFor={id} className={className} id="privacy-label">
            <input
                type="checkbox"
                id={id}
                name="privacy-checkbox"
                checked={isChecked}
                onChange={(e) => onChange(e.target.checked)}
                required
            />
            {t('PrivacyCheckbox.privacy1')}
            <a href="/datenschutz"> {t('PrivacyCheckbox.privacy2')} </a> {t('PrivacyCheckbox.privacy3')}
            <span className="red-highlight">*</span>
        </label>
    )
}

export { PrivacyCheckbox }
