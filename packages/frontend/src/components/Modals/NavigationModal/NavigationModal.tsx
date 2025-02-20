import './NavigationModal.css'

interface NavigationModalProps {
    className?: string
}

const NavigationModal: React.FC<NavigationModalProps> = ({ className }) => {
    return (
        <div className={`navigation-modal modal container ${className}`}>
            <h1>Navigation Modal</h1>
        </div>
    )
}

export default NavigationModal
