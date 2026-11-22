import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const ACCENT = '#c9f75c'
const BG = '#0a0c10'

// Barbell + upward arrow, drawn on a 512x512 canvas.
function artwork() {
  return `
    <g fill="${ACCENT}">
      <rect x="96" y="238" width="320" height="36" rx="18" />
      <rect x="80" y="178" width="46" height="156" rx="18" />
      <rect x="386" y="178" width="46" height="156" rx="18" />
      <rect x="146" y="206" width="34" height="100" rx="14" />
      <rect x="332" y="206" width="34" height="100" rx="14" />
    </g>
    <path d="M256 108 L300 152 H274 V200 H238 V152 H212 Z" fill="${ACCENT}" opacity="0.5" />
  `
}

function svg(scale = 1) {
  const offset = (512 - 512 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${BG}" />
    <g transform="translate(${offset} ${offset}) scale(${scale})">${artwork()}</g>
  </svg>`
}

const targets = [
  ['public/icons/icon-192.png', 192, 1],
  ['public/icons/icon-512.png', 512, 1],
  ['public/icons/icon-maskable-512.png', 512, 0.76],
  ['public/apple-touch-icon.png', 180, 1],
]

await mkdir('public/icons', { recursive: true })
for (const [file, size, scale] of targets) {
  await sharp(Buffer.from(svg(scale))).resize(size, size).png().toFile(file)
  console.log(`wrote ${file} (${size}x${size})`)
}
