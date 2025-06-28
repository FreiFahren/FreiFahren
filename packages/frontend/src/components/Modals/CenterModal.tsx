import React from 'react'

interface CenterModalProps {
    children: React.ReactNode
    animationType?: 'popup' | 'slide-in' | 'slide-out'
    className?: string
}

export const CenterModal = ({ children, animationType = 'popup', className = '' }: CenterModalProps) => {
    const getAnimationClass = () => {
        switch (animationType) {
            case 'popup':
                return 'block animate-popup'
            case 'slide-in':
                return 'block animate-slide-in'
            case 'slide-out':
                return 'block animate-slide-out'
            default:
                return 'block animate-popup'
        }
    }

    return (
        <div
            className={`bg-background fixed left-1/2 top-1/2 z-10 max-h-[80dvh] w-[95vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-black pb-3 pl-2 pr-2 pt-3 text-black shadow-lg ${getAnimationClass()} ${className}`}
        >
            {children}
        </div>
    )
}
