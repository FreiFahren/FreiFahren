import React from 'react'

import './ListModal.css'

interface ListModalProps {
    className?: string
}

const ListModal: React.FC<ListModalProps> = ({ className }) => {
    return (
        <div className={`list-modal modal container ${className}`}>
            <h1>Aktuelle Meldungen</h1>
            <div>
                <div className="align-child-on-line">
                    <h4 className="S41 line-label">S41</h4>
                    <h4>Wedding</h4>
                </div>
                <div>
                    <p>
                        vor 11 min, richtung: <span>Rathaus Steglitz</span>
                    </p>
                </div>
            </div>
            <div>
                <div className="align-child-on-line">
                    <h4 className="S41 line-label">S41</h4>
                    <h4>Wedding</h4>
                </div>
                <div>
                    <p>
                        vor 11 min, richtung: <span>Rathaus Steglitz</span>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default ListModal
