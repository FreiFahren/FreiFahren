import React from 'react';
import { Link } from 'react-router-dom';

import './LegalDisclaimer.css'

interface LegalDisclaimerProps {
    closeModal: () => void;
    openAnimationClass?: string;
}

const LegalDisclaimer: React.FC<LegalDisclaimerProps> = ({ closeModal, openAnimationClass }) => {
  return (
    <div className={`legal-disclaimer container modal ${openAnimationClass}`} id='legal-disclaimer'>
      <h1>Bitte bestätigen Sie vor dem Fortfahren</h1>
      <p>
      Um die Integrität unserer Community und den Geist fairer Nutzung zu wahren, bitten wir Sie, zwei wichtige Punkte zu bestätigen:
      </p>
      <ol>
        <li>
          <strong>Ich besitze ein gültiges Ticket für meine Reise.</strong>
          <p>Ich verstehe, dass diese App dazu dient, das Bewusstsein und die Planung im öffentlichen Nahverkehr zu verbessern, nicht aber um Regeln oder Vorschriften zu umgehen.</p>
        </li>
        <li>
          <strong>Ich nutze die App nicht aktiv während der Fahrt.</strong>
          <p>Mir ist bewusst, dass die aktive Nutzung der App während der Fahrt andere Fahrgäste stören und gegen die Nutzungsbedingungen des Verkehrsbetriebs verstoßen kann.</p>
        </li>
      </ol>
      <div>
        <button onClick={closeModal}>Ich bestätige</button>
      </div>
      <ul className='align-child-on-line'>
        <li><Link to='/impressum'>Impressum</Link></li>
        <li><Link to='/Datenschutz'>Datenschutz</Link></li>
      </ul>
    </div>
  );
}

export default LegalDisclaimer;
