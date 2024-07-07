import React from 'react';

import './LoadingPlaceholder.css';

/**
 * LoadingPlaceholder Component
 *
 * This component renders a placeholder with a loading animation.
 * It's designed to be used in place of content that is still loading.
 *
 * The component creates a gray rectangular area with a subtle shimmering
 * animation to indicate a loading state.
 *
 * In order to use this anywhere please make sure it has a parent element with a sensible width and height.
*/
const LoadingPlaceholder: React.FC = () => {
    return (
        <div className='loading-placeholder'>
            <div className='loading-animation'></div>
        </div>
    );
};

export default LoadingPlaceholder;