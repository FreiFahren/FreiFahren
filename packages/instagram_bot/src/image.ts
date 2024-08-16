import sharp from 'sharp';
import { type Inspector } from './models';

export async function createImage(inspector: Inspector): Promise<Buffer> {
  const width = 1080;
  const height = 1920;

  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="black"/>
      <text x="50" y="100" font-family="Arial" font-size="40" fill="white">Station: ${inspector.station}</text>
      <text x="50" y="150" font-family="Arial" font-size="40" fill="white">Linie: ${inspector.line}</text>
      <text x="50" y="200" font-family="Arial" font-size="40" fill="white">Richtung: ${inspector.direction}</text>
      <text x="50" y="300" font-family="Arial" font-size="30" fill="white">${inspector.message}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}