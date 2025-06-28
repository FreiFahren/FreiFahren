/**
 * Returns the color of a line based on the line name.
 * @param line - The name of the line.
 * @returns The color of the line as a hex string.
 */
export const getLineColor = (line: string): string => {
    switch (true) {
        // Trams are either M1, M2 etc or a number between 1 and 88
        case line.includes('M') ||
            (!Number.isNaN(Number(line)) && Number(line) <= 88 && /^\d+$/.test(line)) ||
            line === 'T':
            return '#be1414'
        // Regional Express
        case line.includes('RE') || line.includes('RB') || line.includes('FEX'):
            return '#e30613'
        // S-Bahn
        case line === 'S2' || line === 'S25' || line === 'S26' || line === 'S':
            return '#007734'
        case line === 'S1':
            return '#da6ba2'
        case line === 'S3':
            return '#0066ad'
        case line === 'S5':
            return '#eb7405'
        case line === 'S41':
            return '#ad5937'
        case line === 'S42':
            return '#cb6418'
        case line === 'S45':
            return '#cd9c53'
        case line === 'S46':
            return '#cd9c53'
        case line === 'S47':
            return '#cd9c53'
        case line === 'S7':
            return '#816da6'
        case line === 'S75':
            return '#816da6'
        case line === 'S8':
            return '#6a2'
        case line === 'S85':
            return '#6a2'
        case line === 'S9':
            return '#992746'
        // U-Bahn
        case line === 'U1':
            return '#7dad4c'
        case line === 'U2':
            return '#da421e'
        case line === 'U3':
            return '#16683d'
        case line === 'U4':
            return '#f0d722'
        case line === 'U5':
            return '#7e5330'
        case line === 'U6':
            return '#8c6dab'
        case line === 'U7':
            return '#528dba'
        case line === 'U8' || line === 'U':
            return '#224f86'
        case line === 'U9':
            return '#f3791d'
        default:
            // must be a bus
            return '#a5027d'
    }
}
