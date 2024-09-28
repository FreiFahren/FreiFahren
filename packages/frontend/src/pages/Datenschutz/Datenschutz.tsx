const Datenschutz = () => {
    return (
        <>
            <div className="legal-text">
                <h1>Datenschutzerklärung für die App "Freifahren"</h1>
                <br />
                <p>Letze aktualisierung: 14.09.2024</p>
                <h2>1. Präambel</h2>
                <p>
                    Diese Datenschutzerklärung informiert Sie über die Art, den Umfang und den Zweck der Verarbeitung
                    personenbezogener Daten in der mobilen Anwendung "Freifahren" (im Folgenden "App"). Die App
                    ermöglicht es Nutzern, Standorte von Ticketkontrolleuren zu melden und diese Informationen anderen
                    Nutzern zur Verfügung zu stellen. Zudem werden Meldungen durch das nicht deterministische und
                    anonymisierte Auswerten der Nachrichten der Freifahren_BE Telegram-Gruppe generiert.
                </p>

                <h2>2. Verantwortliche Stelle</h2>
                <p>
                    Verantwortlich für die Datenverarbeitung im Rahmen dieser App ist die Freifahren GbR, vertreten
                    durch die Gesellschafter, erreichbar unter der E-Mail-Adresse:{' '}
                    <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>.
                </p>

                <h2>3. Rechtsgrundlagen der Datenverarbeitung</h2>
                <p>
                    Die Verarbeitung personenbezogener Daten in unserer App erfolgt auf Basis der folgenden
                    Rechtsgrundlagen gemäß der Datenschutz-Grundverordnung (DSGVO):
                </p>
                <ul>
                    <li>
                        <strong>Einwilligung</strong> (Art. 6 Abs. 1 lit. a DSGVO): Die Nutzer unserer App geben ihre
                        ausdrückliche Einwilligung zur Verarbeitung ihrer personenbezogenen Daten für spezifische
                        Zwecke. Diese Einwilligung kann jederzeit widerrufen werden, wobei der Widerruf die
                        Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung nicht berührt.
                    </li>
                    <li>
                        <strong>Vertragserfüllung und vorvertragliche Maßnahmen</strong> (Art. 6 Abs. 1 lit. b DSGVO):
                        Die Verarbeitung ist notwendig zur Erfüllung eines Vertrags, dessen Vertragspartei die
                        betroffene Person ist, oder zur Durchführung vorvertraglicher Maßnahmen, die auf Anfrage der
                        betroffenen Person erfolgen.
                    </li>
                    <li>
                        <strong>Berechtigte Interessen</strong> (Art. 6 Abs. 1 lit. f DSGVO): Die Verarbeitung ist zur
                        Wahrung der berechtigten Interessen des Verantwortlichen oder eines Dritten erforderlich, sofern
                        nicht die Interessen oder Grundrechte und Grundfreiheiten der betroffenen Person überwiegen.
                    </li>
                </ul>
                <h2>4. Erhebung und Nutzung von Daten</h2>
                <p>Die App erhebt folgende Daten, wenn eine Meldung über Ticketkontrolleure erstellt wird:</p>
                <ul>
                    <li>Linie (optional)</li>
                    <li>Station</li>
                    <li>Richtung (optional)</li>
                    <li>Uhrzeit der Meldung</li>
                    <li>Beschreibungstext (optional)</li>
                </ul>
                <p>
                    Die gemeldeten Daten werden anderen Nutzern der App temporär zur Verfügung gestellt, um ihnen die
                    Möglichkeit zu geben, sich über die aktuelle Situation in den öffentlichen Verkehrsmitteln zu
                    informieren. Des Weiteren werden die Informationen in die Freifahren_BE Telegram-Gruppe
                    weitergeleitet. Diese Datenübermittlung dient dem Austausch und der Information über
                    Ticketkontrollen innerhalb der Community.
                </p>

                <h2>5. Anonymität</h2>
                <p>
                    Es werden keine personenbezogenen Daten der Nutzer gespeichert. Die Meldungen sind anonym, und es
                    können keine Rückschlüsse auf einzelne Personen gezogen werden.
                </p>

                <h2>6. Speicherung und Zugriff</h2>
                <p>
                    Die erhobenen Daten werden auf unseren eigenen Servern gespeichert, die bei der Hetzner Online GmbH
                    in Deutschland gehostet sind. Die Speicherdauer der Daten ist unbefristet. Auch die Dauer, die der
                    Nutzer für das Melden benötigt hat, wird auf diesen Servern gespeichert. Der Zugriff auf die Daten
                    ist streng begrenzt auf die Gesellschafter der Freifahren GbR.
                </p>

                <h2>7. Rechte der Nutzer</h2>
                <p>
                    Nutzer haben das Recht, Auskunft über die sie betreffenden personenbezogenen Daten zu erhalten,
                    sowie die Berichtigung oder Löschung dieser Daten zu verlangen. Anfragen hierzu können über das
                    Kontaktformular der App oder direkt per E-Mail an{' '}
                    <a href="mailto:johan@trieloff.net">johan@trieloff.net</a> gestellt werden.
                </p>

                <h2>8. Zustimmung zur Datenschutzerklärung</h2>
                <p>
                    Nutzer müssen dieser Datenschutzerklärung zustimmen, bevor sie eine Meldung in der App erstellen
                    können. Diese Zustimmung ist Voraussetzung für die Nutzung der App.
                </p>

                <h2>9. Datenschutzbeauftragter</h2>
                <p>
                    Für Fragen zum Datenschutz steht Ihnen unser Datenschutzbeauftragter Johan Trieloff (
                    <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>) zur Verfügung.
                </p>

                <h2>10. Änderungen an der Datenschutzerklärung</h2>
                <p>
                    Wir behalten uns vor, diese Datenschutzerklärung zu ändern, um sie an geänderte Rechtslagen oder
                    Änderungen der App sowie der Datenverarbeitung anzupassen. Nutzer werden gebeten, sich regelmäßig
                    über den Inhalt der Datenschutzerklärung zu informieren.
                </p>

                <h2>11. Verarbeitung von Telegram-Nachrichten</h2>
                <p>
                    Durch den Freifahren Telegram Bot werden Nachrichten aus der Freifahren_BE-Gruppe mit Zustimmung der
                    Administratoren ausgewertet. Die Nachrichten werden nicht gespeichert und nur für die
                    Echtzeit-Auswertung verwendet. Es werden lediglich die nicht deterministisch extrahierten
                    Informationen (Richtung, Linie und Station) aus den Nachrichten gespeichert. Die Uhrzeit wird
                    abgerundet, um die Anonymität zu gewährleisten.
                </p>

                <h2>12. Einsatz von Analysetools</h2>
                <p>
                    Wir verwenden in unserer App die Analyse-Software Pirsch Analytics, um allgemeine
                    Nutzungsinformationen wie Seitenaufrufe und Sitzungsdaten zu erfassen. Bei Pirsch Analytics handelt
                    es sich um eine cookiefreie Webanalysesoftware, die nach dem Grundsatz "Privacy by Design"
                    entwickelt wurde. Zur Analyse der Besucherströme generiert Pirsch Analytics bei Erhalt des
                    Seitenaufrufs mit Hilfe eines Hashing-Algorithmus eine 16-stellige Zahl als Besucher-ID. Als
                    Eingabewerte dienen die IP-Adresse, der User Agent, das Datum und ein Salt.
                </p>
                <p>
                    Die IP-Adresse des Besuchers wird weder vollständig noch in Teilen persistiert und durch den Hash
                    vollständig und nicht reversibel anonymisiert. Durch die Einbindung des Datums und der Verwendung
                    eines Salts pro Webseite ist gewährleistet, dass Webseitenbesucher nicht länger als 24 Stunden
                    wiederzuerkennen sind und nicht über mehrere Webseiten hinweg getrackt werden können. Über eine
                    lokal eingebundene Datenbank wird eine grobe Lokalisierung vorgenommen (Land/Stadt).
                </p>
                <p>Zusätzlich erfasst Pirsch Analytics folgende Informationen:</p>
                <ul>
                    <li>
                        Anzahl der abgegebenen Meldungen und die benötigte Zeit für die Abgabe einer Meldung sowie
                        weitere anonymisierte Parameter.
                    </li>
                    <li>Ob die Risikolinienebene betrachtet wurde.</li>
                    <li>Ob die Liste der Ticketkontrolleure betrachtet wurde.</li>
                    <li>Welcher Marker (roter Punkt) auf der Karte angeklickt wurde.</li>
                    <li>Ob der Standort des Nutzers geteilt wurde und durch welche Methode.</li>
                    <li>Wie lange benötigt wurde, um das erste Fenster zu schließen.</li>
                    <li>Wie das Meldeformular genutzt wurde.</li>
                </ul>
                <p>
                    Diese Daten sind nicht personenbezogen; es werden keine Informationen gesammelt, die eine
                    Identifizierung der Nutzer ermöglichen. Die Nutzung von Pirsch Analytics erfolgt auf Grundlage
                    unserer berechtigten Interessen (Art. 6 Abs. 1 lit. f DSGVO) an einer statistischen Analyse des
                    Nutzerverhaltens, um unsere App zu optimieren.
                </p>
                <p>
                    Die durch Pirsch Analytics erfassten Daten werden auf den Servern der Emvi Software GmbH
                    gespeichert. Die erhobenen Daten werden ausschließlich intern verwendet und nicht an Dritte
                    weitergegeben.
                </p>
                <p>
                    Nutzer haben das Recht, jederzeit Widerspruch gegen diese Form der Datenverarbeitung einzulegen,
                    indem sie die Nutzung der App einstellen.
                </p>

                <h2>13. Salvatorische Klausel</h2>
                <p>
                    Sollten einzelne Bestimmungen dieser Datenschutzerklärung ganz oder teilweise unwirksam oder
                    undurchführbar sein oder nachträglich unwirksam oder undurchführbar werden, so wird dadurch die
                    Gültigkeit der übrigen Bestimmungen nicht berührt. Anstelle der unwirksamen oder undurchführbaren
                    Bestimmung gilt diejenige wirksame und durchführbare Regelung als vereinbart, deren Wirkung der
                    Zielsetzung möglichst nahekommt, die die Parteien mit der unwirksamen bzw. undurchführbaren
                    Bestimmung verfolgt haben. Gleiches gilt für den Fall, dass sich die Datenschutzerklärung als
                    lückenhaft erweist.
                </p>
            </div>
        </>
    )
}

export default Datenschutz
