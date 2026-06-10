/**
 * Generate minimal valid PNG/ICO icons for Tauri development.
 * For production, run: bun tauri icon ./path/to/1024x1024-source.png
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const SCRIPT_DIR = import.meta.dir
const iconsDir = join(SCRIPT_DIR, '..', 'src-tauri', 'icons')
mkdirSync(iconsDir, { recursive: true })

function createChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeBuffer, data])
  const crc = crc32(crcData)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc, 0)
  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xedb88320) : (crc >>> 1)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createPNG(width: number, height: number, r: number, g: number, b: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData.writeUInt8(8, 8)
  ihdrData.writeUInt8(2, 9)
  ihdrData.writeUInt8(0, 10)
  ihdrData.writeUInt8(0, 11)
  ihdrData.writeUInt8(0, 12)
  const ihdr = createChunk('IHDR', ihdrData)

  // Raw pixel data (filter byte 0 + RGB triplets)
  const rawData = Buffer.alloc(1 + width * height * 3)
  rawData.writeUInt8(0, 0)
  for (let i = 0; i < width * height; i++) {
    const offset = 1 + i * 3
    rawData.writeUInt8(r, offset)
    rawData.writeUInt8(g, offset + 1)
    rawData.writeUInt8(b, offset + 2)
  }

  const compressed = deflateSync(rawData)
  const idat = createChunk('IDAT', compressed)
  const iend = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// Brand color: #005faa
const R = 0x00, G = 0x5f, B = 0xaa

const sizes: Array<[string, number]> = [
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['icon.png', 512],
]

for (const [filename, size] of sizes) {
  writeFileSync(join(iconsDir, filename), createPNG(size, size, R, G, B))
  console.log(`Created ${filename} (${size}x${size})`)
}

// ICO file (Windows) — wraps 32x32 PNG
const icoPNG = createPNG(32, 32, R, G, B)
const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(1, 4)

const icoEntry = Buffer.alloc(16)
icoEntry.writeUInt8(32, 0)
icoEntry.writeUInt8(32, 1)
icoEntry.writeUInt8(0, 2)
icoEntry.writeUInt8(0, 3)
icoEntry.writeUInt16LE(1, 4)
icoEntry.writeUInt16LE(32, 6)
icoEntry.writeUInt32LE(icoPNG.length, 8)
icoEntry.writeUInt32LE(22, 12)

writeFileSync(join(iconsDir, 'icon.ico'), Buffer.concat([icoHeader, icoEntry, icoPNG]))
console.log('Created icon.ico')

// Create a placeholder .icns for macOS (needs proper generation on macOS)
writeFileSync(join(iconsDir, 'icon.icns'), Buffer.from('icns'))
console.log('Created placeholder icon.icns')
console.log('\nNote: For production, generate proper icons with:')
console.log('  bun tauri icon ./path/to/1024x1024-source.png')
