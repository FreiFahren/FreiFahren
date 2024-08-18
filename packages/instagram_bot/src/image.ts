import sharp from 'sharp'
import { type Inspector } from './models'

export async function createImage(inspectors: Inspector[]): Promise<Buffer> {
    console.log('Creating image with inspectors:', inspectors)
    const width = 1080
    const height = 1920

    const inspectorSvgs = inspectors
        .map((inspector, index) => {
            let yOffset = index * 150
            let svg = `
                <g transform="translate(0, ${yOffset})">
                    <text x="50" y="100" font-family="Arial" font-size="30" fill="white">Station: ${inspector.station.name}</text>
            `
            if (inspector.line) {
                svg += `<text x="50" y="140" font-family="Arial" font-size="30" fill="white">Linie: ${inspector.line}</text>`
                yOffset += 40
            }
            if (inspector.direction && inspector.direction.name) {
                svg += `<text x="50" y="${yOffset + 140}" font-family="Arial" font-size="30" fill="white">Richtung: ${
                    inspector.direction.name
                }</text>`
            }
            svg += `</g>`
            return svg
        })
        .join('')

    const svg = `
        <svg width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="black"/>
            <text x="50" y="50" font-family="Arial" font-size="40" fill="white">Ticket Inspectors Report</text>
            ${inspectorSvgs}
            <text x="50" y="${
                height - 20
            }" font-family="Arial" font-size="20" fill="white">Mehr Info auf app.freigfahren.org</text>
        </svg>
    `

    return sharp(Buffer.from(svg)).png().toBuffer()
}
