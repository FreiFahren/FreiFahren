import './CloseButton.css'

interface CloseButtonProps {
    handleClose: () => void
}

// fuck them prop types, fix later
// eslint-disable-next-line react/prop-types
export const CloseButton: React.FC<CloseButtonProps> = ({ handleClose }) => (
  <button 
    className="small-button close-button center-child"
    onClick={handleClose}
    type="button"
    aria-label="Close"
  >
    ×
    </button>
)
