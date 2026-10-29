import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
export function dampAngle(current, target, lambda, dt) {
  let d = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
}
export function shortestAngle(from, to) {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function mergeGeometries(geometries) {
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const source of geometries) {
    const g = source.index ? source.toNonIndexed() : source;
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) normals.push(n.getX(i), n.getY(i), n.getZ(i));
      else normals.push(0, 1, 0);
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      else uvs.push(0, 0);
    }
    if (g !== source) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.computeBoundingSphere();
  return out;
}

export function transformed(geometry, position, rotation, scale) {
  const g = geometry.clone();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
  m.compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    q,
    new THREE.Vector3(scale[0], scale[1], scale[2])
  );
  g.applyMatrix4(m);
  return g;
}

export function canvasTexture(width, height, draw, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = options.anisotropy || 4;
  if (options.repeat) tex.repeat.set(options.repeat[0], options.repeat[1]);
  if (options.nearest) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
  }
  return tex;
}

let glowTexCache = null;
export function glowTexture() {
  if (glowTexCache) return glowTexCache;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.24, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexCache = new THREE.CanvasTexture(c);
  glowTexCache.colorSpace = THREE.SRGBColorSpace;
  return glowTexCache;
}

export function makeGlowSprite(color, size, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

export function textTexture(text, options = {}) {
  const size = options.size || 128;
  const pad = options.pad ?? 16;
  const font = options.font || `900 ${size * 0.72}px Impact, "Arial Black", sans-serif`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width + pad * 2);
  const h = Math.ceil(size + pad * 2);
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (options.glow !== false) {
    ctx.shadowColor = options.glowColor || options.color || '#ffffff';
    ctx.shadowBlur = options.glowBlur ?? 26;
    ctx.strokeStyle = options.glowColor || options.color || '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeText(text, w / 2, h / 2);
  }
  ctx.fillStyle = options.color || '#ffffff';
  ctx.fillText(text, w / 2, h / 2);
  if (options.stroke) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 2;
    ctx.strokeText(text, w / 2, h / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        if (m.emissiveMap) m.emissiveMap.dispose();
        m.dispose();
      }
    }
  });
}
