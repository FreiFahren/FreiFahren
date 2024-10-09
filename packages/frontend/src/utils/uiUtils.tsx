export function highlightElement(id: string) {
    const element = document.getElementById(id)

    if (element !== null) {
        if (element) {
            element.classList.add('highlight')
            setTimeout(() => {
                element.classList.remove('highlight')
            }, 3000)
        }
    } else {
        const elementClass = document.getElementsByClassName(id)

        if (elementClass) {
            elementClass[0].classList.add('highlight')
            setTimeout(() => {
                elementClass[0].classList.remove('highlight')
            }, 3000)
        }
    }
}

export function createWarningSpan(elementId: string, message: string) {
    let warningSpan = document.getElementById('warning-span')
    if (!warningSpan) {
        warningSpan = document.createElement('span')
        warningSpan.id = 'warning-span'
        warningSpan.className = 'red-highlight'
        warningSpan.textContent = message
        document.getElementById(elementId)?.appendChild(warningSpan)
    }
}

export const currentColorTheme = () => {
    const colorTheme = localStorage.getItem('colorTheme')
    return colorTheme ? colorTheme : 'dark'
}

export function setColorThemeInLocalStorage() {
    const colorTheme = currentColorTheme()

    if (colorTheme === 'dark') {
        localStorage.setItem('colorTheme', 'light')
    } else {
        localStorage.setItem('colorTheme', 'dark')
    }
}
