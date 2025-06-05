import React from 'react'

interface CenterModalProps {
    children: React.ReactNode
    className?: string
}

export const CenterModal = ({ children, className }: CenterModalProps) => {
    return (
        <div
            className={`bg-background fixed left-1/2 top-1/2 z-10 max-h-[80dvh] w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-black pb-3 pl-2 pr-2 pt-3 text-black shadow-lg ${className}`}
        >
            {children}
        </div>
    )
}
