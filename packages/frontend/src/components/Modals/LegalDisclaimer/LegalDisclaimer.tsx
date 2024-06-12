import React from 'react';

interface LegalDisclaimerProps {
    closeModal: () => void;
    className?: string;
}

const LegalDisclaimer: React.FC<LegalDisclaimerProps> = ({ closeModal, className }) => {
  return (
    <div className={`legal-disclaimer container modal ${className}`} id='legal-disclaimer'>
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
    </div>
  );
}

export default LegalDisclaimer;
