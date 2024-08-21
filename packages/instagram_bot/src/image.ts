import sharp from 'sharp'
import { type Inspector } from './models'

function estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * 0.6
}

function getLineColor(line: string): string {
    const lineColors: Record<string, string> = {
        S1: '#da6ba2',
        S2: '#007734',
        S3: '#0066ad',
        S5: '#eb7405',
        S7: '#816da6',
        S8: '#66aa22',
        S9: '#992746',
        S41: '#ad5937',
        S42: '#cb6418',
        S45: '#cd9c53',
        S46: '#cd9c53',
        S47: '#cd9c53',
        S25: '#007734',
        S26: '#007734',
        S75: '#816da6',
        S85: '#66aa22',
        U1: '#7DAD4C',
        U2: '#DA421E',
        U3: '#16683D',
        U4: '#F0D722',
        U5: '#7E5330',
        U6: '#8C6DAB',
        U7: '#528DBA',
        U8: '#224F86',
        U9: '#F3791D',
    }
    return lineColors[line] || '#ffffff'
}

function createInspectorSvg(inspector: Inspector, index: number): string {
    const yOffset = 250 + index * 100
    const stationWidth = estimateTextWidth(inspector.station.name, 40)
    let lineX = stationWidth + 120
    let directionX = lineX

    let svg = `
        <g transform="translate(0, ${yOffset})">
            <circle cx="70" cy="0" r="8" fill="white" />
            <text x="100" y="10" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white">${inspector.station.name}</text>
    `

    if (inspector.line) {
        const lineColor = getLineColor(inspector.line)
        const lineWidth = estimateTextWidth(inspector.line, 40)
        const lineBgWidth = lineWidth + 20
        const lineBgHeight = 50
        svg += `
            <rect x="${lineX}" y="-30" width="${lineBgWidth}" height="${lineBgHeight}" rx="8" ry="8" fill="${lineColor}" />
            <text x="${
                lineX + lineBgWidth / 2
            }" y="10" font-family="Raleway" font-size="40" font-weight="bold" fill="white" text-anchor="middle">${
            inspector.line
        }</text>
        `
        directionX = lineX + lineBgWidth + 40
    }

    if (inspector.direction && inspector.direction.name) {
        svg += `<text x="${directionX}" y="10" font-family="Arial, sans-serif" font-size="40" fill="white">${inspector.direction.name}</text>`
    }

    svg += `</g>`
    return svg
}

function createSvgContent(width: number, height: number, inspectorSvgs: string): string {
    return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#232323"/>
            <text x="70" y="175" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white">Aktuelle Meldungen</text>
            ${inspectorSvgs}
            <text x="70" y="${
                height - 60
            }" font-family="Arial, sans-serif" font-size="40" fill="white">Mehr Infos auf <tspan text-decoration="underline">app.freifahren.org</tspan></text>
        </svg>
    `
}

export async function createImage(inspectors: Inspector[]): Promise<Buffer> {
    const width = 1080
    const height = 1920

    const inspectorSvgs = inspectors.map(createInspectorSvg).join('')

    const svg = createSvgContent(width, height, inspectorSvgs)

    return sharp(Buffer.from(svg)).png().toBuffer()
}
