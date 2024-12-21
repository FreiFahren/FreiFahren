import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom"

const Support = () => {
    const { t } = useTranslation()

    return (
        <div className="legal-text">
            <h1>{t("SupportPage.title")}</h1>
            <br />
            <h2>iOS/Android</h2>
            <p>{t("SupportPage.mobile")}{" "}<a href="mailto:moritzamando@proton.me">moritzamando@proton.me</a></p>
            <h2>Web</h2>
            <p>{t("SupportPage.web")}{" "}<a href="mailto@johan@trieloff.net">johan@trieloff.net</a></p>
            <div>
                <ul className="row">
                    <li>
                        <Link to="/impressum">{t("SupportPage.impressum")}</Link>
                    </li>
                    <li>
                        <Link to="/Datenschutz">{t("SupportPage.privacy")}</Link>
                    </li>
                </ul>
            </div>
        </div>
    )
}

export { Support }
