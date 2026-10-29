import * as THREE from 'three'

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas2d(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return { canvas, ctx: canvas.getContext('2d') }
}

function grain(ctx, w, h, amount, rng) {
  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * amount
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n))
  }
  ctx.putImageData(image, 0, 0)
}

function finalTexture(canvas, repeat = true) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  texture.needsUpdate = true
  return texture
}

export function makeFacade(seed, palette) {
  const rng = mulberry32(seed)
  const w = 128
  const h = 256
  const base = canvas2d(w, h)
  const glow = canvas2d(w, h)

  const gradient = base.ctx.createLinearGradient(0, 0, w, h)
  gradient.addColorStop(0, palette[0])
  gradient.addColorStop(1, palette[1])
  base.ctx.fillStyle = gradient
  base.ctx.fillRect(0, 0, w, h)

  base.ctx.fillStyle = 'rgba(0,0,0,0.2)'
  for (let y = 0; y < h; y += 16) base.ctx.fillRect(0, y, w, 1)

  glow.ctx.fillStyle = '#000'
  glow.ctx.fillRect(0, 0, w, h)

  const colors = ['#ffd9a3', '#a9f6ff', '#ff9fd2', '#d9c8ff', '#ffedc2']
  const cols = 6
  const rows = 15
  const cw = w / cols
  const ch = h / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() > 0.46
      const x = c * cw + 3
      const y = r * ch + 4
      const ww = cw - 6
      const hh = ch - 7
      base.ctx.fillStyle = lit ? 'rgba(18, 24, 40, 0.5)' : 'rgba(5, 8, 15, 0.6)'
      base.ctx.fillRect(x, y, ww, hh)
      if (lit) {
        const color = colors[Math.floor(rng() * colors.length)]
        glow.ctx.fillStyle = color
        glow.ctx.globalAlpha = 0.55 + rng() * 0.45
        glow.ctx.fillRect(x, y, ww, hh)
        glow.ctx.globalAlpha = 0.16
        glow.ctx.fillRect(x - 2, y - 2, ww + 4, hh + 4)
      }
    }
  }
  glow.ctx.globalAlpha = 1
  grain(base.ctx, w, h, 13, rng)

  const map = finalTexture(base.canvas)
  const emissiveMap = finalTexture(glow.canvas)
  return { map, emissiveMap }
}

export function makeAsphalt() {
  const rng = mulberry32(7001)
  const { canvas, ctx } = canvas2d(256, 256)
  ctx.fillStyle = '#26212f'
  ctx.fillRect(0, 0, 256, 256)
  grain(ctx, 256, 256, 20, rng)
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.035})`
    ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 2, 1 + rng() * 2)
  }
  return finalTexture(canvas)
}

export function makeConcrete() {
  const rng = mulberry32(7123)
  const { canvas, ctx } = canvas2d(256, 256)
  ctx.fillStyle = '#5f586b'
  ctx.fillRect(0, 0, 256, 256)
  grain(ctx, 256, 256, 18, rng)
  ctx.strokeStyle = 'rgba(10, 8, 16, 0.28)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 256)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(256, i)
    ctx.stroke()
  }
  return finalTexture(canvas)
}

export function makeSand() {
  const rng = mulberry32(7229)
  const { canvas, ctx } = canvas2d(256, 256)
  ctx.fillStyle = '#9d7b62'
  ctx.fillRect(0, 0, 256, 256)
  grain(ctx, 256, 256, 26, rng)
  return finalTexture(canvas)
}

export function makeGlowTexture() {
  const { canvas, ctx } = canvas2d(128, 128)
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.72)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.16)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return finalTexture(canvas, false)
}

export function makeShadowTexture() {
  const { canvas, ctx } = canvas2d(128, 128)
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.25)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return finalTexture(canvas, false)
}

export function makeSmokeTexture() {
  const { canvas, ctx } = canvas2d(64, 64)
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return finalTexture(canvas, false)
}

export function makeBillboardTexture(text, accent = '#ff2d87', background = '#120a1d') {
  const { canvas, ctx } = canvas2d(512, 256)
  const bg = ctx.createLinearGradient(0, 0, 512, 256)
  bg.addColorStop(0, background)
  bg.addColorStop(1, '#06040b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 256)

  ctx.strokeStyle = accent
  ctx.lineWidth = 5
  ctx.strokeRect(12, 12, 488, 232)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.strokeRect(20, 20, 472, 216)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.font = '700 20px Rajdhani, Arial, sans-serif'
  ctx.letterSpacing = '8px'
  ctx.fillText('VICE HARBOR', 256, 62)
  ctx.fillStyle = accent
  ctx.shadowColor = accent
  ctx.shadowBlur = 26
  ctx.font = '700 78px Impact, "Arial Black", sans-serif'
  ctx.fillText(text, 256, 138)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.font = '600 18px Rajdhani, Arial, sans-serif'
  ctx.fillText('OPEN ALL NIGHT', 256, 207)
  return finalTexture(canvas, false)
}

export function makeOceanTexture() {
  const { canvas, ctx } = canvas2d(128, 128)
  const gradient = ctx.createLinearGradient(0, 0, 0, 128)
  gradient.addColorStop(0, '#0d3d50')
  gradient.addColorStop(1, '#061c2c')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return finalTexture(canvas)
}
