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
                elementClass[0].classList.remove('highlight')
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

/**
 * Returns the color of a line based on the line name.
 * @param line - The name of the line.
 * @returns The color of the line as a hex string.
 */
export const getLineColor = (line: string): string => {
    switch (line) {
        case 'S1':
            return '#da6ba2'
        case 'S2':
            return '#007734'
        case 'S3':
            return '#0066ad'
        case 'S5':
            return '#eb7405'
        case 'S25':
            return '#007734'
        case 'S26':
            return '#007734'
        case 'S41':
            return '#ad5937'
        case 'S42':
            return '#cb6418'
        case 'S45':
            return '#cd9c53'
        case 'S46':
            return '#cd9c53'
        case 'S47':
            return '#cd9c53'
        case 'S7':
            return '#816da6'
        case 'S75':
            return '#816da6'
        case 'S8':
            return '#6a2'
        case 'S85':
            return '#6a2'
        case 'S9':
            return '#992746'
        case 'U1':
            return '#7dad4c'
        case 'U2':
            return '#da421e'
        case 'U3':
            return '#16683d'
        case 'U4':
            return '#f0d722'
        case 'U5':
            return '#7e5330'
        case 'U6':
            return '#8c6dab'
        case 'U7':
            return '#528dba'
        case 'U8':
            return '#224f86'
        case 'U9':
            return '#f3791d'
        case 'M1':
            return '#be1414'
        case 'M2':
            return '#be1414'
        case 'M4':
            return '#be1414'
        case 'M5':
            return '#be1414'
        case 'M6':
            return '#be1414'
        case 'M8':
            return '#be1414'
        case 'M10':
            return '#be1414'
        case 'M13':
            return '#be1414'
        case 'M17':
            return '#be1414'
        default:
            return '#000000'
    }
}
