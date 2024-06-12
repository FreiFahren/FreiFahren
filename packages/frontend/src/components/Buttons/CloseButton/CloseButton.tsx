import './CloseButton.css'

interface CloseButtonProps {
  closeModal: () => void;
}

export const CloseButton: React.FC<CloseButtonProps> = ({ closeModal }) => {
  return (
    <button className='small-button close-button center-child' onClick={closeModal}>
    </button>
  );
};
