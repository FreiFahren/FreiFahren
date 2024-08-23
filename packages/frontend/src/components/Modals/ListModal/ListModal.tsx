import React from 'react'

import './ListModal.css'

interface ListModalProps {
    className?: string
}

const ListModal: React.FC<ListModalProps> = ({ className }) => {
    return (
        <div className={`modal container ${className}`}>
            <p>Liste</p>
        </div>
    )
}

export default ListModal
