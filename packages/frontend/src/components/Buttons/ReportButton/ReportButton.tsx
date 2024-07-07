import React, { MouseEventHandler } from 'react';

import './ReportButton.css';

interface ReportButtonProps {
    onClick: MouseEventHandler<HTMLButtonElement>;
}

const ReportButton: React.FC<ReportButtonProps> = ({ onClick }) => {

    return (
        <button className='report-button action center-child' onClick={onClick} aria-label='report ticketinspector'>
            <div className='plus'>
                <span></span>
                <span></span>
            </div>
        </button>
    );
};

export default ReportButton;