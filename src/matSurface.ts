import { CanvasTexture } from 'three'

export function createMatSurface(width: number, height: number) {
  const canvas = document.createElement('canvas')
  const scale = Math.min(devicePixelRatio, 2.0)
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // 1. Base Rich Dark Forest Emerald Rubber/Vinyl Gradient
  const bgGrad = ctx.createRadialGradient(
    width * 0.48, height * 0.45, width * 0.08,
    width * 0.5, height * 0.5, Math.max(width, height) * 0.82
  )
  bgGrad.addColorStop(0, '#104631')
  bgGrad.addColorStop(0.45, '#0b3926')
  bgGrad.addColorStop(0.85, '#072619')
  bgGrad.addColorStop(1, '#051d13')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // 2. Micro Vinyl Texture
  const grainImg = ctx.createImageData(Math.min(width, 512), Math.min(height, 512))
  for (let i = 0; i < grainImg.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 14
    grainImg.data[i] = 12 + noise
    grainImg.data[i + 1] = 42 + noise
    grainImg.data[i + 2] = 28 + noise
    grainImg.data[i + 3] = 25
  }
  const grainCanvas = document.createElement('canvas')
  grainCanvas.width = grainImg.width
  grainCanvas.height = grainImg.height
  grainCanvas.getContext('2d')!.putImageData(grainImg, 0, 0)
  ctx.fillStyle = ctx.createPattern(grainCanvas, 'repeat')!
  ctx.fillRect(0, 0, width, height)

  // 3. Grid Dimensions
  const portrait = width < height
  const left = portrait ? width * 0.08 : 52
  const top = portrait ? height * 0.06 : 48
  const right = width - left
  const bottom = portrait ? height * 0.94 : height - 48
  const cell = portrait ? (right - left) / 16 : 52

  // 4. Subtle Fine Sub-grid (1/2 cell)
  ctx.strokeStyle = 'rgba(210, 240, 220, 0.16)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  const halfCell = cell / 2
  for (let x = left; x <= right + 0.1; x += halfCell) {
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
  }
  for (let y = top; y <= bottom + 0.1; y += halfCell) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()

  // 5. Primary Measurement Grid Lines
  ctx.strokeStyle = 'rgba(225, 248, 232, 0.62)'
  ctx.lineWidth = 1.0
  ctx.beginPath()
  for (let x = left; x <= right + 0.1; x += cell) {
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
  }
  for (let y = top; y <= bottom + 0.1; y += cell) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()

  // 6. Subtle localized cutting marks (micro knife scratches)
  ctx.strokeStyle = 'rgba(235, 255, 242, 0.08)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(left + cell * 3, top + cell * 4)
  ctx.lineTo(left + cell * 5.5, top + cell * 3.8)
  ctx.moveTo(right - cell * 4, bottom - cell * 3)
  ctx.lineTo(right - cell * 2.2, bottom - cell * 3.2)
  ctx.moveTo(left + cell * 7, bottom - cell * 2)
  ctx.lineTo(left + cell * 9, bottom - cell * 2.1)
  ctx.stroke()

  // 7. Outer Mat Border
  ctx.strokeStyle = 'rgba(225, 248, 232, 0.85)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(left, top, right - left, bottom - top)

  // 8. Precision Ruler Ticks along All 4 Edges
  ctx.strokeStyle = 'rgba(225, 248, 232, 0.68)'
  ctx.lineWidth = 0.85
  ctx.beginPath()
  const tickStep = cell / 4
  // Top and bottom ticks
  for (let x = left; x <= right + 0.1; x += tickStep) {
    const isMajor = Math.abs((x - left) % cell) < 1
    const isMedium = Math.abs((x - left) % (cell / 2)) < 1
    const len = isMajor ? 11 : isMedium ? 7 : 4
    ctx.moveTo(x, top)
    ctx.lineTo(x, top - len)
    ctx.moveTo(x, bottom)
    ctx.lineTo(x, bottom + len)
  }
  // Left and right ticks
  for (let y = top; y <= bottom + 0.1; y += tickStep) {
    const isMajor = Math.abs((y - top) % cell) < 1
    const isMedium = Math.abs((y - top) % (cell / 2)) < 1
    const len = isMajor ? 11 : isMedium ? 7 : 4
    ctx.moveTo(left, y)
    ctx.lineTo(left - len, y)
    ctx.moveTo(right, y)
    ctx.lineTo(right + len, y)
  }
  ctx.stroke()

  // 9. Printed Measurement Numbers
  const fontSize = portrait ? Math.max(9, width * 0.02) : 11
  ctx.font = `600 ${fontSize}px "Outfit", Arial, sans-serif`
  ctx.fillStyle = 'rgba(220, 245, 230, 0.68)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Top numbers
  let colIndex = 1
  for (let x = left + cell; x < right; x += cell) {
    ctx.fillText(String(colIndex++), x, top - 16)
  }
  // Bottom numbers
  colIndex = 1
  for (let x = left + cell; x < right; x += cell) {
    if (colIndex % 2 === 1) {
      ctx.fillText(String(colIndex), x, bottom + 16)
    }
    colIndex++
  }
  // Left numbers
  let rowIndex = 1
  for (let y = top + cell; y < bottom; y += cell) {
    ctx.fillText(String(rowIndex++), left - 16, y)
  }
  // Right numbers
  rowIndex = 1
  for (let y = top + cell; y < bottom; y += cell) {
    ctx.fillText(String(24 - rowIndex), right + 16, y)
    rowIndex++
  }

  // Corner Unit Stamp
  ctx.font = `700 ${fontSize * 0.85}px "Outfit", Arial, sans-serif`
  ctx.fillText('INCH', left - 24, top - 16)

  return new CanvasTexture(canvas)
}
