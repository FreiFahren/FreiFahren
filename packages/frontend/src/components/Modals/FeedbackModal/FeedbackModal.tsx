import React from 'react';

import './FeedbackModal.css';

interface FeedbackModalProps {
    openAnimationClass?: string;
}

const github_icon = `${process.env.PUBLIC_URL}/icons/github.svg`;

const FeedbackModal: React.FC<FeedbackModalProps> = ({ openAnimationClass }) => {
    return (
        <div className={`feedback-modal modal container ${openAnimationClass}`}>
            <h1>Sende dein Feedback an:</h1>
            <ul>
                <li>
                    <img
                    className='profile-picture'
                    src={process.env.PUBLIC_URL + '/icons/profiles/moritz.jpeg'}
                    alt='Moritz Github Profile Picture'
                    />
                    <p>Moritz</p>
                    <div>
                        <a href='https://github.com/mclrc' target='_blank' rel='noopener noreferrer'>
                            <img src={github_icon} alt='github icon'/>
                        </a>
                    </div>
                </li>
                <li>
                    <img
                    className='profile-picture'
                    src={process.env.PUBLIC_URL + '/icons/profiles/joff.jpeg'}
                    alt='Joff Github Profile Picture'
                    />
                    <p>Joff</p>
                    <div>
                        <a href='hhttps://github.com/jfsalzmann' target='_blank' rel='noopener noreferrer'>
                            <img src={github_icon} alt='github icon'/>
                        </a>
                    </div>
                </li>
                <li>
                    <img
                    className='profile-picture'
                    src={process.env.PUBLIC_URL + '/icons/profiles/johan.jpeg'}
                    alt='Johan Github Profile Picture'
                    />
                    <p>Johan</p>
                    <div>
                        <a href='https://github.com/johan-t' target='_blank' rel='noopener noreferrer'>
                            <img src={github_icon} alt='github icon'/>
                        </a>
                    </div>
                </li>
                <li>
                    <img
                    className='profile-picture'
                    src={process.env.PUBLIC_URL + '/icons/profiles/david.jpeg'}
                    alt='David Github Profile Picture'
                    />
                    <p>David</p>
                    <div>
                        <a href='https://github.com/brandesdavid' target='_blank' rel='noopener noreferrer'>
                            <img src={github_icon} alt='github icon'/>
                        </a>
                    </div>
                </li>
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