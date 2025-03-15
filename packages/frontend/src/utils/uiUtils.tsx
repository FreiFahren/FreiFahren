export const highlightElement = (id: string): void => {
    const element = document.getElementById(id)

    if (element !== null) {
        element.classList.add('highlight')
        setTimeout(() => {
            element.classList.remove('highlight')
        }, 3000)
    } else {
        const elementClass = document.getElementsByClassName(id)

        if (elementClass.length > 0) {
            elementClass[0].classList.add('highlight')
            setTimeout(() => {
                if (elementClass.length > 0) {
                    elementClass[0].classList.remove('highlight')
                }
            }, 3000)
        }
    }
}

export const createWarningSpan = (elementId: string, message: string): void => {
    let warningSpan = document.getElementById('warning-span')

    if (!warningSpan) {
        warningSpan = document.createElement('span')
        warningSpan.id = 'warning-span'
        warningSpan.className = 'red-highlight'
        warningSpan.textContent = message
        document.getElementById(elementId)?.appendChild(warningSpan)
    }
}
