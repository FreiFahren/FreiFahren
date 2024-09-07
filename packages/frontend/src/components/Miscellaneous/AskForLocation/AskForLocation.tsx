import { useState, useEffect } from 'react'

import './AskForLocation.css'
import AutocompleteInputForm from '../../Form/AutocompleteInputForm/AutocompleteInputForm'
import { useLocation } from '../../../contexts/LocationContext'

interface AskForLocationProps {
    className: string
    children?: React.ReactNode
    closeModal: () => void
}

const AskForLocation: React.FC<AskForLocationProps> = ({ className, children, closeModal }) => {
    const [isValid, setIsValid] = useState(false)
    const { setUserPosition } = useLocation()

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        closeModal()
    }
    return (
        <div className={`ask-for-location info-popup modal ${className}`}>
            {children}
            <form onSubmit={handleSubmit}>
                <h1>Was ist deine nächste Station?</h1>
                <p>Wir konnten deinen Standort nicht finden</p>

                <button type="submit" className={isValid ? '' : 'button-gray'}>
                    Standort setzen
                </button>
            </form>
        </div>
    )
}

export default AskForLocation
