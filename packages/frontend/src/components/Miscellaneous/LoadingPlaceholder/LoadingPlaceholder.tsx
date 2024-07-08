import React, { useState, useEffect } from 'react';
import './LoadingPlaceholder.css';

interface LoadingPlaceholderProps {
    isLoading: boolean;
    initialDelay?: number;
    minDisplayTime?: number;
}

/**
 * LoadingPlaceholder Component
 *
 * This component renders a placeholder with a loading animation.
 * It's designed to be used in place of content that is still loading.
 *
 * The component creates a gray rectangular area with a subtle shimmering
 * animation to indicate a loading state.
 *
 * Behavior:
 * 1. Waits for an initial delay before showing. Inorder to avoid flickering.
 * 2. If content loads before this delay, the placeholder is never shown.
 * 3. Once shown, it remains visible for at least the minDisplayTime, even if the content loads before that to avoid flickering.
 *
 * In order to use this anywhere, please make sure it has a parent element with a sensible width and height.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isLoading - Whether the content is currently loading
 * @param {number} [props.initialDelay=50] - Initial delay in milliseconds before showing the loading placeholder
 * @param {number} [props.minDisplayTime=1000] - Minimum time in milliseconds to display the placeholder once shown
 * @returns {JSX.Element | null} A div with loading animation or null if not shown
 */
const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
    isLoading,
    initialDelay = 100,
    minDisplayTime = 1000
}) => {
    const [shouldShow, setShouldShow] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    useEffect(() => {
        let initialTimer: NodeJS.Timeout;
        let displayTimer: NodeJS.Timeout;

        if (isLoading && !shouldShow) {
            initialTimer = setTimeout(() => {
                setShouldShow(true);
                setStartTime(Date.now());
            }, initialDelay);
        } else if (shouldShow && startTime) {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

            displayTimer = setTimeout(() => {
                if (!isLoading) {
                    setShouldShow(false);
                    setStartTime(null);
                }
            }, remainingTime);
        }

        return () => {
            clearTimeout(initialTimer);
            clearTimeout(displayTimer);
        };
    }, [isLoading, shouldShow, startTime, initialDelay, minDisplayTime]);

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