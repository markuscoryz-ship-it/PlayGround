import * as THREE from 'three'

function canvas2d(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function noise(ctx, w, h, amount, alpha = 0.1) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
  if (alpha > 0) {
    ctx.globalAlpha = alpha
    for (let i = 0; i < 2400; i++) {
      const s = Math.random() * 1.6 + 0.2
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
      ctx.fillRect(Math.random() * w, Math.random() * h, s, s)
    }
    ctx.globalAlpha = 1
  }
}

export function asphaltTexture() {
  const [c, ctx] = canvas2d(512, 512)
  ctx.fillStyle = '#24222b'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 30},${38 + Math.random() * 25},${46 + Math.random() * 28},.18)`
    ctx.beginPath()
    ctx.ellipse(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 70, 3 + Math.random() * 24, Math.random() * 3, 0, 7)
    ctx.fill()
  }
  noise(ctx, 512, 512, 26, 0.16)
  ctx.strokeStyle = 'rgba(8,7,12,.28)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 8; i++) {
    ctx.beginPath()
    let x = Math.random() * 512
    let y = Math.random() * 512
    ctx.moveTo(x, y)
    for (let j = 0; j < 8; j++) {
      x += (Math.random() - 0.5) * 26
      y += Math.random() * 22
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function sidewalkTexture() {
  const [c, ctx] = canvas2d(512, 512)
  ctx.fillStyle = '#8c857e'
  ctx.fillRect(0, 0, 512, 512)
  noise(ctx, 512, 512, 22, 0.09)
  ctx.strokeStyle = 'rgba(42,37,40,.28)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke()
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(${60 + Math.random() * 30},${55 + Math.random() * 25},${55 + Math.random() * 25},.14)`
    ctx.beginPath()
    ctx.arc(Math.random() * 512, Math.random() * 512, 12 + Math.random() * 40, 0, 7)
    ctx.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function sandTexture() {
  const [c, ctx] = canvas2d(512, 512)
  ctx.fillStyle = '#c9a47e'
  ctx.fillRect(0, 0, 512, 512)
  noise(ctx, 512, 512, 30, 0.06)
  for (let i = 0; i < 55; i++) {
    ctx.strokeStyle = `rgba(110,78,60,${0.05 + Math.random() * 0.08})`
    ctx.lineWidth = 1 + Math.random() * 2
    ctx.beginPath()
    const y = Math.random() * 512
    for (let x = 0; x <= 512; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 4)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function facadeTexture(base = '#293242', windowColor = '#0b1424', accent = '#3b4a5f') {
  const [c, ctx] = canvas2d(256, 512)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 512)
  noise(ctx, 256, 512, 12, 0.04)
  ctx.fillStyle = accent
  for (let y = 0; y < 512; y += 64) ctx.fillRect(0, y, 256, 2)
  ctx.fillStyle = windowColor
  for (let y = 18; y < 500; y += 64) {
    for (let x = 16; x < 246; x += 48) {
      ctx.fillRect(x, y, 28, 34)
      ctx.fillStyle = 'rgba(255,255,255,.05)'
      ctx.fillRect(x, y, 28, 4)
      ctx.fillStyle = windowColor
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function signTexture(text, opts = {}) {
  const {
    width = 512, height = 256, color = '#ff4f9a', glow = '#ff86c0',
    bg = 'rgba(12,6,22,.86)', font = 'Impact, Arial Black, sans-serif',
    sub = '', border = true, vertical = false
  } = opts
  const [c, ctx] = canvas2d(width, height)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  if (border) {
    ctx.strokeStyle = color
    ctx.lineWidth = 7
    ctx.shadowColor = glow
    ctx.shadowBlur = 22
    ctx.strokeRect(12, 12, width - 24, height - 24)
    ctx.shadowBlur = 0
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.shadowColor = glow
  ctx.shadowBlur = 30
  if (vertical) {
    const chars = [...text]
    const step = (height - 50) / chars.length
    const size = Math.min(width * 0.62, step * 0.9)
    ctx.font = `${size}px ${font}`
    chars.forEach((ch, i) => ctx.fillText(ch, width / 2, 28 + step * (i + 0.5)))
  } else {
    const size = Math.min(height * (sub ? 0.43 : 0.58), (width * 1.7) / Math.max(4, text.length))
    ctx.font = `${size}px ${font}`
    ctx.fillText(text, width / 2, sub ? height * 0.44 : height * 0.52)
    if (sub) {
      ctx.shadowBlur = 12
      ctx.font = `${Math.max(14, size * 0.24)}px "Arial Narrow", sans-serif`
      ctx.fillStyle = 'rgba(255,245,225,.86)'
      ctx.fillText(sub, width / 2, height * 0.75)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function billboardTexture(index = 0) {
  const [c, ctx] = canvas2d(512, 256)
  const themes = [
    ['VICE', 'FEEL THE HEAT', '#ff3d7f', '#2a0630', '#4ce6ff'],
    ['NEON', 'AFTER DARK', '#4ce6ff', '#06141f', '#ff8b3d'],
    ['PARADISE', 'IS A STATE OF MIND', '#ffd34e', '#260d20', '#ff4f9a'],
    ['OCEAN DR', 'LIVE THE SUNSET', '#ff8b3d', '#081a2c', '#c8ff5c']
  ]
  const [title, sub, a, bg, b] = themes[index % themes.length]
  const g = ctx.createLinearGradient(0, 0, 512, 256)
  g.addColorStop(0, bg)
  g.addColorStop(1, '#090716')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = a
  ctx.lineWidth = 3
  ctx.strokeRect(15, 15, 482, 226)
  ctx.fillStyle = a
  ctx.globalAlpha = 0.18
  ctx.beginPath()
  ctx.arc(420, 70, 110, 0, 7)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff4df'
  ctx.font = '68px Impact, Arial Black, sans-serif'
  ctx.shadowColor = a
  ctx.shadowBlur = 18
  ctx.fillText(title, 34, 126)
  ctx.shadowBlur = 0
  ctx.fillStyle = a
  ctx.font = '20px "Arial Narrow", sans-serif'
  ctx.fillText(sub, 38, 170)
  ctx.fillStyle = b
  ctx.fillRect(38, 196, 116, 5)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, ctx] = canvas2d(128, 128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(0.22, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function lightStreakTexture(color = '#fff0d0') {
  const [c, ctx] = canvas2d(256, 64)
  const g = ctx.createLinearGradient(0, 0, 256, 0)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(128, 32, 120, 11, 0, 0, 7)
  ctx.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function envTexture() {
  const [c, ctx] = canvas2d(1024, 512)
  const sky = ctx.createLinearGradient(0, 0, 0, 512)
  sky.addColorStop(0, '#170a2f')
  sky.addColorStop(0.34, '#5b1e63')
  sky.addColorStop(0.49, '#ff7a45')
  sky.addColorStop(0.53, '#ffb26b')
  sky.addColorStop(0.56, '#191323')
  sky.addColorStop(1, '#08060e')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1024, 512)
  const sun = ctx.createRadialGradient(512, 255, 2, 512, 255, 170)
  sun.addColorStop(0, 'rgba(255,248,220,1)')
  sun.addColorStop(0.1, 'rgba(255,220,150,.95)')
  sun.addColorStop(0.34, 'rgba(255,122,58,.5)')
  sun.addColorStop(1, 'rgba(255,90,50,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, 1024, 512)
  ctx.fillStyle = 'rgba(255,244,223,.16)'
  for (let i = 0; i < 18; i++) {
    ctx.beginPath()
    ctx.ellipse(Math.random() * 1024, 150 + Math.random() * 110, 40 + Math.random() * 130, 3 + Math.random() * 7, 0, 0, 7)
    ctx.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function minimapTexture(size = 512) {
  const [c, ctx] = canvas2d(size, size)
  ctx.fillStyle = '#101726'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#1c2a3a'
  for (let i = 0; i < 36; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 10 + Math.random() * 40, 10 + Math.random() * 40)
  }
  return c
}

export function palmLeafTexture() {
  const [c, ctx] = canvas2d(256, 64)
  ctx.clearRect(0, 0, 256, 64)
  const g = ctx.createLinearGradient(0, 0, 256, 0)
  g.addColorStop(0, 'rgba(26,80,48,.95)')
  g.addColorStop(0.6, 'rgba(48,120,64,.98)')
  g.addColorStop(1, 'rgba(86,150,80,.92)')
  ctx.strokeStyle = g
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(4, 32)
  ctx.quadraticCurveTo(130, 28, 250, 35)
  ctx.stroke()
  for (let i = 8; i < 250; i += 7) {
    const t = i / 250
    const spread = 22 * Math.sin(t * Math.PI) + 4
    ctx.strokeStyle = `rgba(${30 + t * 50},${95 + t * 55},${50 + t * 35},${0.85 - t * 0.22})`
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(i, 32)
    ctx.lineTo(i + 7, 32 - spread)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(i, 32)
    ctx.lineTo(i + 7, 32 + spread * 0.9)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function woodTexture() {
  const [c, ctx] = canvas2d(512, 128)
  ctx.fillStyle = '#6b4b35'
  ctx.fillRect(0, 0, 512, 128)
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${30 + Math.random() * 30},${18 + Math.random() * 18},${10 + Math.random() * 12},${0.12 + Math.random() * 0.22})`
    ctx.lineWidth = 1 + Math.random() * 2
    ctx.beginPath()
    const y = Math.random() * 128
    for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.5)
    ctx.stroke()
  }
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = 'rgba(25,15,10,.32)'
    ctx.fillRect(x, 0, 2, 128)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
