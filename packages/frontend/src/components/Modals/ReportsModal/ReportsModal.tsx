import React from 'react'

interface ReportsModalProps {
    className?: string
}

const ReportsModal: React.FC<ReportsModalProps> = ({ className }) => {
    return (
        <div className={`list-modal modal container ${className}`}>
            <h1>Reports</h1>
        </div>
    )
}

export default ReportsModal
