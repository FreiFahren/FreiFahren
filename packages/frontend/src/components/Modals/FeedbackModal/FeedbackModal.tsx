import React from 'react';

import './FeedbackModal.css';

interface FeedbackModalProps {
    openAnimationClass?: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ openAnimationClass }) => {
    return (
        <div className={`feedback-modal modal container ${openAnimationClass}`}>
            <h1>Sende uns dein Feedback</h1>
            <ul>
                <li><p>David</p></li>
                <li><p>Joff</p></li>
                <li><p>Moritz</p></li>
                <li><p>Johan</p></li>
            </ul>
            <h2>Über uns</h2>
            <p>
                FreiFahren ist ein nicht-kommerzielles Open-Source-Projekt, das sich zum Ziel gesetzt hat, den Zugang zum öffentlichen Nahverkehr zu erleichtern.
                Wir sind stets offen für neue Mithelfer auf unserem GitHub.
            </p>
            <p>
                Ein Großteil der Meldungen stammt aus der FreiFahren_BE Telegram-Gruppe.
                Dank der Admins und unserem Telegram-Bot extrahieren wir relevante Daten aus den Nachrichten.
            </p>
        </div>
    );
}

export default FeedbackModal;