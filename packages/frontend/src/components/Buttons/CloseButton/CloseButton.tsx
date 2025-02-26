import './CloseButton.css'

interface CloseButtonProps {
    handleClose: () => void
}

const CloseButton: React.FC<CloseButtonProps> = ({ handleClose }) => (
    <button className="small-button close-button center-child" onClick={handleClose} type="button" aria-label="Close">
        ×
    </button>
)

export default CloseButton
