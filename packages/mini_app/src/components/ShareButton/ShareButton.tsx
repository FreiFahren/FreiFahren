import React from 'react'
import { Report } from '../../utils/types'
import './ShareButton.css'

// Type declaration for Telegram WebApp
declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                openTelegramLink?: (url: string) => void
            }
        }
    }
}

interface ShareButtonProps {
    report: Report
}

export const ShareButton: React.FC<ShareButtonProps> = ({ report }) => {
    const handleShare = () => {
        const shareText = `🚨 Kontrolle gemeldet: ${report.station.name}${report.line ? ` (${report.line})` : ''}${report.direction ? ` → ${report.direction.name}` : ''}\n\nMelde auch du Kontrollen: https://app.freifahren.org`
        
        // Try to use Telegram's share functionality if available
        if (window.Telegram?.WebApp?.openTelegramLink) {
            const encodedText = encodeURIComponent(shareText)
            window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=https://app.freifahren.org&text=${encodedText}`)
        } else if (navigator.share) {
            // Fallback to Web Share API
            navigator.share({
                title: `FreiFahren - Kontrolle gemeldet: ${report.station.name}`,
                text: shareText,
                url: `https://app.freifahren.org/station/${report.station.id}`
            }).catch(console.error)
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(shareText).then(() => {
                alert('Text in die Zwischenablage kopiert!')
            }).catch(() => {
                alert('Teilen nicht verfügbar')
            })
        }
    }

    return (
        <button className="share-button" onClick={handleShare} type="button">
            <img
                className="share-icon"
                src="/share-svgrepo-com.svg"
                alt="share"
            />
            Teilen
        </button>
    )
} 