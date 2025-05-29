import React from 'react'

interface CenterModalProps {
    children: React.ReactNode
    className?: string
}

export const CenterModal = ({ children, className }: CenterModalProps) => {
    return (
        <div
            className={`bg-background fixed left-1/2 top-1/2 z-10 h-[80dvh] w-[85vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-black p-6 text-black shadow-lg ${className}`}
        >
            {children}
        </div>
    )
}
