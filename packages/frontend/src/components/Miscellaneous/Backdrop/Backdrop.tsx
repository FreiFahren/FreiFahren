import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'

import './Backdrop.css'

interface BackdropProps {
    onClick: () => void
    BackgroundColor?: string
    Zindex?: number
}

const Backdrop: React.FC<BackdropProps> = ({ onClick, BackgroundColor, Zindex }) => {
    const backdropRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const backdrop = backdropRef.current

        const handleScroll = (event: Event) => {
            if (event.target === backdrop) {
                onClick()
            }
        }

        // avoid closing the backdrop when scrolling on anything but the backdrop
        if (backdrop) {
            backdrop.addEventListener('scroll', handleScroll, { passive: true })
            backdrop.addEventListener('touchmove', handleScroll, { passive: true })
        }
        return () => {
            if (backdrop) {
                backdrop.removeEventListener('scroll', handleScroll)
                backdrop.removeEventListener('touchmove', handleScroll)
            }
        }
    }, [onClick])

    return ReactDOM.createPortal(
        <div
            ref={backdropRef}
            className="backdrop"
            onClick={onClick}
            data-testid="backdrop"
            style={{
                backgroundColor: BackgroundColor || 'rgba(0, 0, 0, 0.5)',
                zIndex: Zindex || 1, // should be same as --zIndex-backdrop
            }}
        />,
        document.getElementById('portal-root') as HTMLElement
    )
}

export default Backdrop
