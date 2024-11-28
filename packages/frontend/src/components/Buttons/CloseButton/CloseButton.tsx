import './CloseButton.css'

interface CloseButtonProps {
    closeModal: () => void
}

// eslint-disable-next-line jsx-a11y/control-has-associated-label, react/button-has-type
export const CloseButton: React.FC<CloseButtonProps> = ({ closeModal }: CloseButtonProps) => <button className="small-button close-button center-child" onClick={closeModal} />
