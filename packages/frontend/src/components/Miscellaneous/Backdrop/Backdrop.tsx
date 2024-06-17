import React from 'react';
import ReactDOM from 'react-dom';

import './Backdrop.css';

interface BackdropProps {
    onClick: () => void;
    BackgroundColor?: string;
}

const Backdrop: React.FC<BackdropProps> = ({ onClick, BackgroundColor }) => {
    console.log('Backdrop rendered');

    // Render in the portal-root to avoid overlapping with Map component
    return ReactDOM.createPortal(
        <div
            className='backdrop'
            onClick={onClick}
            data-testid='backdrop'
            style={{ backgroundColor: BackgroundColor || 'rgba(0, 0, 0, 0.5)' }}
        />,
        document.getElementById('portal-root') as HTMLElement
    );
};

export default Backdrop;
