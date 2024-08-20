import sharp from 'sharp'
import { type Inspector } from './models'
import fs from 'fs/promises'
import path from 'path'

function estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * 0.6
}

async function loadFont(fontPath: string): Promise<string> {
    const fontData = await fs.readFile(fontPath)
    return fontData.toString('base64')
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

/**
 * Creates an SVG element containing the information of the given inspector.
 * The inspector's station name is displayed at the left, followed by the line and direction if available.
 *
 * @param {Inspector} inspector - An inspector object containing information to be displayed on the image.
 * @param {number} index - The index of the inspector in the array.
 * @returns {string} - An SVG string representing the inspector's information. The SVG is positioned at the top of the final image.
 */
function createInspectorSvg(inspector: Inspector, index: number): string {
    const yOffset = 250 + index * 100
    const stationWidth = estimateTextWidth(inspector.station.name, 40)
    let lineX = stationWidth + 120
    let directionX = lineX

    let svg = `
        <g transform="translate(0, ${yOffset})">
            <circle cx="70" cy="0" r="8" fill="white" />
            <text x="100" y="10" font-family="Raleway" font-size="40" font-weight="bold" fill="white">${inspector.station.name}</text>
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
        svg += `<text x="${directionX}" y="10" font-family="Raleway" font-size="40" fill="white">${inspector.direction.name}</text>`
    }

    svg += `</g>`
    return svg
}

/**
 * Creates the SVG content for the image.
 * The content includes the title, inspector information, and a link to the app website.
 * The title is displayed at the top, followed by the inspector svg from the createInspectorSvg function, and the link at the bottom.
 *
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 * @param {string} fontBase64 - The base64-encoded font data.
 * @param {string} inspectorSvgs - A string containing the SVG elements for the inspectors.
 * @returns {string} - An SVG string representing the image content.
 */
function createSvgContent(width: number, height: number, fontBase64: string, inspectorSvgs: string): string {
    return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>
                    @font-face {
                        font-family: 'Raleway';
                        src: url(data:application/font-ttf;charset=utf-8;base64,${fontBase64}) format('truetype');
                        font-weight: normal;
                        font-style: normal;
                    }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="#232323"/>
            <text x="70" y="120" font-family="Raleway" font-size="80" font-weight="bold" fill="white">Aktuelle Meldungen</text>
            ${inspectorSvgs}
            <text x="70" y="${
                height - 60
            }" font-family="Raleway" font-size="40" fill="white">Mehr Infos auf <tspan text-decoration="underline">app.freifahren.org</tspan></text>
        </svg>
    `
}

/**
 * Creates an image with the given inspectors' information. The image is a 1080x1920 PNG with a dark background and white text.
 *
 * @param {Inspector[]} inspectors - An array of inspector objects containing information to be displayed on the image.
 * @returns {Promise<Buffer>} - A promise that resolves to a Buffer containing the generated image data.
 */
export async function createImage(inspectors: Inspector[]): Promise<Buffer> {
    const width = 1080
    const height = 1920

    const fontPath = `${process.env.APP_URL}/fonts/static/Raleway-Regular.ttf`
    const fontBase64 = await loadFont(fontPath)

    const inspectorSvgs = inspectors.map(createInspectorSvg).join('')

    const svg = createSvgContent(width, height, fontBase64, inspectorSvgs)

    return sharp(Buffer.from(svg)).png().toBuffer()
}
