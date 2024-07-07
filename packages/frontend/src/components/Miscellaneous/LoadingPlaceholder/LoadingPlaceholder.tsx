import React from 'react';

import './LoadingPlaceholder.css';

const LoadingPlaceholder: React.FC = () => {
    return (
        <div className='loading-placeholder'>
            <div className='loading-animation'></div>
        </div>
    );
};

export default LoadingPlaceholder;