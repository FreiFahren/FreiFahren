import { Link } from "react-router-dom"

const Support = () => {
  return (
    <div className="legal-text">
      <h1>Support</h1>
      <br />
      <h2>iOS/Android</h2>
      <p>Bei Problemen oder Anregungen bezüglich der Mobile-App, melde dich bitte bei Moritz unter <a href="mailto:moritzamando@proton.me">moritzamando@proton.me</a></p>
      <h2 style={{ marginTop: 16 }}>Web</h2>
      <p>Falls du ein Problem mit der Website hast, kontaktiere bitte Johan unter <a href="mailto@johan@trieloff.net">johan@trieloff.net</a></p>
      <div>
        <ul style={{ display: "flex", flexDirection: "row", gap: 10 }}>
          <li>
            <Link to="/impressum">Impressum</Link>
          </li>
          <li>
            <Link to="/Datenschutz">Datenschutz</Link>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Support
