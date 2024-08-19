import sharp from 'sharp'
import { type Inspector } from './models'
import fs from 'fs/promises'
import path from 'path'

function estimateTextWidth(text: string, fontSize: number): number {
    // This is a rough estimate. Adjust the multiplier as needed for your font.
    return text.length * fontSize * 0.6
}

export async function createImage(inspectors: Inspector[]): Promise<Buffer> {
    console.log('Creating image with inspectors:', inspectors)
    const width = 1080
    const height = 1920

    // Read the Raleway font file
    const fontPath = path.join(__dirname, '../fonts/Raleway/static/Raleway-Regular.ttf')
    const fontData = await fs.readFile(fontPath)
    const fontBase64 = fontData.toString('base64')

    const inspectorSvgs = inspectors
        .map((inspector, index) => {
            let yOffset = 250 + index * 100
            const stationWidth = estimateTextWidth(inspector.station.name, 40)
            let lineX = stationWidth + 120 // 20px gap after station name
            let directionX = lineX

            let svg = `
                <g transform="translate(0, ${yOffset})">
                    <circle cx="70" cy="0" r="8" fill="white" />
                    <text x="100" y="10" font-family="Raleway" font-size="40" font-weight="bold" fill="white">${inspector.station.name}</text>
            `

            if (inspector.line) {
                svg += `<text x="${lineX}" y="10" font-family="Raleway" font-size="40" fill="white">${inspector.line}</text>`
                directionX = lineX + estimateTextWidth(inspector.line, 40) + 20 // 20px gap after line
            }

            if (inspector.direction && inspector.direction.name) {
                svg += `<text x="${directionX}" y="10" font-family="Raleway" font-size="40" fill="white">${inspector.direction.name}</text>`
            }

            svg += `</g>`
            return svg
        })
        .join('')

    const svg = `
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

    return sharp(Buffer.from(svg)).png().toBuffer()
}
