import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// Preserve geometry and PBR channels; resize embedded images without recompression
// to lossy JPEG (normal and metallic/roughness maps must retain their channels).
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hellens-models-'))
fs.mkdirSync('public/models', { recursive: true })
for (const name of ['macbook_laptop', 'retro_gameboy']) {
  const source = fs.readFileSync(`.openai/${name}.glb`)
  const jsonLength = source.readUInt32LE(12)
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString())
  const binary = source.subarray(28 + jsonLength)
  const images = new Map(json.images.map(image => [image.bufferView, image]))
  const chunks = []
  let offset = 0
  json.bufferViews.forEach((view, index) => {
    let bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)
    if (images.has(index)) {
      const image = images.get(index)
      const filename = path.join(temporary, `${name}-${index}.${image.mimeType === 'image/png' ? 'png' : 'jpg'}`)
      fs.writeFileSync(filename, bytes)
      execFileSync('sips', ['-Z', '1024', filename], { stdio: 'ignore' })
      bytes = fs.readFileSync(filename)
    }
    view.byteOffset = offset
    view.byteLength = bytes.length
    chunks.push(bytes)
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4)
    chunks.push(padding)
    offset += bytes.length + padding.length
  })
  json.buffers[0].byteLength = offset
  const raw = Buffer.from(JSON.stringify(json))
  const metadata = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)])
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(28 + metadata.length + offset, 8)
  header.writeUInt32LE(metadata.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binaryHeader = Buffer.alloc(8)
  binaryHeader.writeUInt32LE(offset); binaryHeader.writeUInt32LE(0x004e4942, 4)
  const result = Buffer.concat([header, metadata, binaryHeader, ...chunks])
  fs.writeFileSync(`public/models/${name}.glb`, result)
  console.log(`${name}: ${(source.length / 1048576).toFixed(1)} → ${(result.length / 1048576).toFixed(1)} MB`)
}
