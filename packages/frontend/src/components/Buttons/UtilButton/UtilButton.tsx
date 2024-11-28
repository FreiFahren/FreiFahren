import './UtilButton.css'

interface UtilButtonProps {
    onClick: () => void
}

export const UtilButton = ({ onClick }: UtilButtonProps) => {
    const settingsSvg = `${process.env.PUBLIC_URL}/icons/settings.svg`

    return (
        // eslint-disable-next-line react/button-has-type
        <button className="util-button small-button" onClick={onClick} aria-label="utility info">
            <img src={settingsSvg} alt="settings" />
        </button>
    )
}
