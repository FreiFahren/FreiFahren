import React from 'react'
import './MarketingModal.css'

interface MarketingModalProps {
    className?: string
    children?: React.ReactNode
}

const MarketingModal: React.FC<MarketingModalProps> = ({ className, children }) => {
    return (
        <div className={`marketing-modal info-popup modal ${className}`}>
            {children}
            <div className="marketing-modal-content">
                <h1>Marketing Modal</h1>
                <p>This is a marketing modal</p>
            </div>
        </div>
    )
}

export default MarketingModal
