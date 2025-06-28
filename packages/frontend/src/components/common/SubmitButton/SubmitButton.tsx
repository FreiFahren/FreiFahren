import { ButtonHTMLAttributes } from 'react'

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: string
    isValid: boolean
}

export const SubmitButton = ({ children, isValid, className, ...props }: SubmitButtonProps) => {
    const baseClasses =
        'w-full h-10 rounded text-center text-base font-semibold min-w-[100px] transition-all duration-300 cursor-pointer hover:brightness-110'
    const validClasses = isValid ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-500 text-white hover:brightness-100'

    const combinedClassName = className
        ? `${baseClasses} ${validClasses} ${className}`
        : `${baseClasses} ${validClasses}`

    return (
        <button type="submit" className={combinedClassName} {...props}>
            <p className="m-0">{children}</p>
        </button>
    )
}
