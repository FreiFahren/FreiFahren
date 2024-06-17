import React, {useEffect} from 'react';
import ReactDOM from 'react-dom';

import './Backdrop.css';

interface BackdropProps {
    onClick: () => void;
    BackgroundColor?: string;
}

const Backdrop: React.FC<BackdropProps> = ({ onClick, BackgroundColor }) => {
    // Close the backdrop when the user scrolls or touches the screen
    useEffect(() => {
        window.addEventListener('scroll', onClick, { passive: true });
        window.addEventListener('touchmove', onClick, { passive: true });

        return () => {
            window.removeEventListener('scroll', onClick);
            window.removeEventListener('touchmove', onClick);
        };
    }, [onClick]);

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
