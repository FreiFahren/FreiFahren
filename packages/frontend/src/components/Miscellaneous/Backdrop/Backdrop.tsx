import React from 'react';

import './Backdrop.css';

interface BackdropProps {
    onClick: () => void;
}

const Backdrop: React.FC<BackdropProps> = ({ onClick }) => {
    return (
        <div
            className='backdrop'
            onClick={onClick}
            data-testid='backdrop'
        />
    );
};

export default Backdrop;