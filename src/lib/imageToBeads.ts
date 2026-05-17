export interface BeadColorEntry {
  code: string
  hex: string
  series: string
}

export interface BeadCell {
  code: string
  hex: string
}

export interface ConversionResult {
  grid: BeadCell[][]
  counts: Record<string, number>
  width: number
  height: number
}

// sRGB linearization (gamma removal)
function linearize(v: number): number {
  const n = v / 255
  return n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92
}

// RGB → CIELAB (D65 illuminant)
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = linearize(r), lg = linearize(g), lb = linearize(b)
  // linear RGB → XYZ, normalized by D65 white point
  const X = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047
  const Y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750) / 1.00000
  const Z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}

// Squared ΔE (skip sqrt — only used for comparison, not display)
function deltaESq(a: [number, number, number], b: [number, number, number]): number {
  const dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2]
  return dl * dl + da * da + db * db
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

interface PaletteEntry {
  code: string
  hex: string
  lab: [number, number, number]
}

function buildPalette(colors: BeadColorEntry[]): PaletteEntry[] {
  return colors.map(c => {
    const [r, g, b] = hexToRgb(c.hex)
    return { code: c.code, hex: c.hex, lab: rgbToLab(r, g, b) }
  })
}

function findNearest(r: number, g: number, b: number, palette: PaletteEntry[]): PaletteEntry {
  const lab = rgbToLab(r, g, b)
  let best = palette[0]
  let bestDist = Infinity
  for (const p of palette) {
    const d = deltaESq(lab, p.lab)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best
}

/**
 * Convert an image to a perler bead grid.
 *
 * Uses avg pooling (via Canvas drawImage bilinear downscale) then
 * nearest-neighbor quantization in CIELAB color space.
 */
export function convertToBeads(
  imageEl: HTMLImageElement,
  gridW: number,
  gridH: number,
  palette: BeadColorEntry[],
): ConversionResult {
  const canvas = document.createElement('canvas')
  canvas.width = gridW
  canvas.height = gridH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // White background (so transparent areas map to white beads)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, gridW, gridH)
  ctx.drawImage(imageEl, 0, 0, gridW, gridH)

  const pixels = ctx.getImageData(0, 0, gridW, gridH).data
  const pal = buildPalette(palette)

  const grid: BeadCell[][] = []
  const counts: Record<string, number> = {}

  for (let y = 0; y < gridH; y++) {
    const row: BeadCell[] = []
    for (let x = 0; x < gridW; x++) {
      const i = (y * gridW + x) * 4
      const nearest = findNearest(pixels[i], pixels[i + 1], pixels[i + 2], pal)
      row.push({ code: nearest.code, hex: nearest.hex })
      counts[nearest.code] = (counts[nearest.code] ?? 0) + 1
    }
    grid.push(row)
  }

  return { grid, counts, width: gridW, height: gridH }
}

/** Draw the bead grid to a canvas element for display. */
export function renderBeadGrid(
  canvas: HTMLCanvasElement,
  grid: BeadCell[][],
  cellSize: number,
): void {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  canvas.width = w * cellSize
  canvas.height = h * cellSize
  const ctx = canvas.getContext('2d')!

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = grid[y][x].hex
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    }
  }

  // Grid lines for larger cell sizes
  if (cellSize >= 5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let x = 0; x <= w; x++) {
      ctx.moveTo(x * cellSize, 0)
      ctx.lineTo(x * cellSize, h * cellSize)
    }
    for (let y = 0; y <= h; y++) {
      ctx.moveTo(0, y * cellSize)
      ctx.lineTo(w * cellSize, y * cellSize)
    }
    ctx.stroke()
  }
}

/** Calculate grid dimensions that maintain the image aspect ratio. */
export function calcAspectGrid(
  imgW: number,
  imgH: number,
  maxDim: number,
): { w: number; h: number } {
  if (imgW >= imgH) {
    return { w: maxDim, h: Math.max(1, Math.round(maxDim * imgH / imgW)) }
  }
  return { w: Math.max(1, Math.round(maxDim * imgW / imgH)), h: maxDim }
}
