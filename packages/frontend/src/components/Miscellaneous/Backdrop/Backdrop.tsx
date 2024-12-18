import './Backdrop.css'

import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'

interface BackdropProps {
    handleClick: () => void
    BackgroundColor?: string
    Zindex?: number
}

const Backdrop: React.FC<BackdropProps> = ({ handleClick, BackgroundColor, Zindex }) => {
    const backdropRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const backdrop = backdropRef.current

        const handleScroll = (event: Event) => {
            if (event.target === backdrop) {
                handleClick()
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
    }, [handleClick])

    return ReactDOM.createPortal(
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div
            ref={backdropRef}
            className="backdrop"
            onClick={handleClick}
            data-testid="backdrop"
            style={{
                backgroundColor: BackgroundColor ?? 'rgba(0, 0, 0, 0.5)',
                zIndex: Zindex ?? 1, // should be same as --zIndex-backdrop
            }}
        />,
        document.getElementById('portal-root') as HTMLElement
    )
}

export { Backdrop }
