import React, { useState, useEffect } from 'react';
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
 * To avoid flickering for very short loading times, the component
 * becomes visible only after a short delay (default 200ms).
 *
 * In order to use this anywhere please make sure it has a parent element with a sensible width and height.
 * Simply add a state to track when the content is loading and render this component conditionally.
 *
 * @param {number} [props.delay=100] - Delay in milliseconds before showing the loading placeholder
 * @returns {JSX.Element | null} A div with loading animation or null if the delay hasn't elapsed
 */
const LoadingPlaceholder: React.FC<{ delay?: number }> = ({ delay = 100 }) => {
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldShow(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    if (!shouldShow) {
        return null;
    }

    return (
        <div className='loading-placeholder'>
            <div className='loading-animation'></div>
        </div>
    );
};

export default LoadingPlaceholder;