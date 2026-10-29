import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'
import { buildCity, CITY } from './city.js'
import { createCar, updateCarVisuals, setVehicleQuality } from './vehicles.js'
import { createPlayer, animatePlayer, flashMuzzle } from './player.js'
import { envTexture, glowTexture } from './textures.js'

const $ = (id) => document.getElementById(id)
const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || innerWidth < 900
const lowQuality = isTouch
if (isTouch) document.body.classList.add('touch')
document.body.classList.add('driving')
$('btn-action').querySelector('span').textContent = 'EXIT'
$('btn-sprint').querySelector('span').textContent = 'BOOST'

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x8b4d5d, 190, 860)
const camera = new THREE.PerspectiveCamera(isTouch && innerHeight > innerWidth ? 69 : 62, innerWidth / innerHeight, 0.1, 1800)

let renderer
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: false, powerPreference: 'high-performance', stencil: false })
} catch (error) {
  document.getElementById('splash').innerHTML = '<div style="font:12px sans-serif;color:#fff;letter-spacing:.2em">WEBGL UNAVAILABLE</div>'
  throw error
}
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.96
renderer.shadowMap.enabled = !lowQuality
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const pmrem = new THREE.PMREMGenerator(renderer)
const envMap = pmrem.fromEquirectangular(envTexture()).texture
scene.environment = envMap
pmrem.dispose()

setVehicleQuality(lowQuality)
const city = buildCity(scene, { low: lowQuality })

let composer = null
let bloom = null
let fxaa = null
if (!lowQuality) {
  composer = new EffectComposer(renderer)
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.7))
  composer.setSize(innerWidth, innerHeight)
  composer.addPass(new RenderPass(scene, camera))
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.48, 0.88)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  fxaa = new ShaderPass(FXAAShader)
  fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * renderer.getPixelRatio()), 1 / (innerHeight * renderer.getPixelRatio()))
  composer.addPass(fxaa)
}

const car = createCar('infernus')
if (lowQuality) car.traverse((o) => { if (o.isSpotLight) o.visible = false })
car.position.set(CITY.start.x, 0.02, CITY.start.z)
car.rotation.y = CITY.start.heading
scene.add(car)

const player = createPlayer()
player.visible = false
scene.add(player)

const targetMeshes = []
for (const ped of city.peds) targetMeshes.push(...ped.group.children)
for (const t of city.traffic) targetMeshes.push(...t.group.children)

const state = {
  mode: 'driving',
  carPos: new THREE.Vector3(CITY.start.x, 0.02, CITY.start.z),
  heading: CITY.start.heading,
  vel: new THREE.Vector3(),
  speed: 0,
  steer: 0,
  onFootPos: new THREE.Vector3(CITY.start.x + 2.4, 0.16, CITY.start.z),
  onFootVel: new THREE.Vector3(),
  onFootHeading: 0,
  onGround: true,
  camYaw: CITY.start.heading,
  camPitch: 0.11,
  orbitYaw: 0,
  lookVelocity: 0,
  camLook: new THREE.Vector3(CITY.start.x, 1, CITY.start.z + 12),
  camPos: new THREE.Vector3(CITY.start.x, 4.2, CITY.start.z - 9),
  cash: 2450,
  health: 100,
  armor: 100,
  heat: 0,
  wanted: 0,
  lastCrime: -999,
  lastDamage: -999,
  fire: false,
  fireHeld: false,
  cooldown: 0,
  boost: false,
  handbrake: false,
  joystick: { x: 0, y: 0 },
  sprintHeld: false,
  jumpHeld: false,
  tilt: false,
  tiltValue: 0,
  tiltBaseline: null,
  tiltSeen: false,
  muted: false,
  shake: 0,
  time: 0,
  mission: { target: new THREE.Vector3(CITY.target.x, 0, CITY.target.z), timer: 120, total: 120, index: 0, distance: 0, startDist: 1 },
  police: [],
  policeTimer: 0,
  particles: [],
  tracers: [],
  dustTimer: 0,
  engineTimer: 0
}
state.mission.startDist = state.carPos.distanceTo(state.mission.target)
city.setTarget(state.mission.target.x, state.mission.target.z)

const keys = new Set()
const raycaster = new THREE.Raycaster()
raycaster.camera = camera
const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()
const tmpV3 = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const sparkTex = glowTexture('rgba(255,235,170,1)', 'rgba(255,100,20,0)')
const smokeTex = glowTexture('rgba(190,175,165,.34)', 'rgba(120,105,100,0)')
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })

function updateTargetList() {
  targetMeshes.length = 0
  for (const ped of city.peds) if (!ped.dead) for (const o of ped.group.children) if (o.isMesh) targetMeshes.push(o)
  for (const t of city.traffic) for (const o of t.group.children) if (o.isMesh) targetMeshes.push(o)
  for (const p of state.police) for (const o of p.group.children) if (o.isMesh) targetMeshes.push(o)
}
updateTargetList()

function toast(text, icon = '') {
  $('toast-text').textContent = text
  $('toast-icon').style.background = icon || '#ff8b3d'
  $('toast-icon').style.boxShadow = `0 0 10px ${icon || '#ff8b3d'}`
  const el = $('toast')
  el.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400)
}

function setCash(amount, delta = 0) {
  state.cash = Math.max(0, amount)
  $('cash').textContent = '$' + Math.round(state.cash).toLocaleString('en-US')
  if (delta) {
    const el = $('money')
    el.classList.remove('bump')
    void el.offsetWidth
    el.classList.add('bump')
  }
}

function updateWantedUI() {
  const stars = document.querySelectorAll('#wanted .star')
  stars.forEach((star, i) => {
    star.classList.toggle('on', i < state.wanted)
    star.classList.toggle('pulse', i < state.wanted && i === state.wanted - 1 && state.wanted > 0)
  })
}

function addHeat(amount) {
  state.heat = clamp(state.heat + amount, 0, 5)
  const wanted = Math.min(5, Math.ceil(state.heat))
  if (wanted !== state.wanted) {
    state.wanted = wanted
    updateWantedUI()
    if (wanted > 0) toast(`WANTED LEVEL ${wanted}`, '#ffd34e')
  }
  state.lastCrime = state.time
  if (state.wanted > 0) state.policeTimer = Math.min(state.policeTimer, 0.4)
}

function damagePlayer(amount) {
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, amount * 0.72)
    state.armor -= absorbed
    amount -= absorbed
  }
  state.health = clamp(state.health - amount, 0, 100)
  state.lastDamage = state.time
  state.shake = Math.max(state.shake, 0.24)
  $('damage').classList.add('show')
  clearTimeout(damagePlayer.timer)
  damagePlayer.timer = setTimeout(() => $('damage').classList.remove('show'), 180)
  if (state.health <= 0) wasted()
}

function wasted() {
  $('wasted').classList.add('show')
  state.health = 100
  state.armor = 60
  state.heat = 0
  state.wanted = 0
  state.lastDamage = state.time
  updateWantedUI()
  state.cash = Math.max(0, state.cash - 500)
  setCash(state.cash)
  for (const p of state.police) scene.remove(p.group)
  state.police.length = 0
  updateTargetList()
  setTimeout(() => {
    state.mode = 'driving'
    document.body.classList.remove('on-foot')
    document.body.classList.add('driving')
$('btn-action').querySelector('span').textContent = 'EXIT'
$('btn-sprint').querySelector('span').textContent = 'BOOST'
    state.carPos.set(CITY.start.x, 0.02, CITY.start.z)
    state.heading = CITY.start.heading
    state.vel.set(0, 0, 0)
    state.speed = 0
    state.camYaw = state.heading
    state.orbitYaw = 0
    car.position.copy(state.carPos)
    car.rotation.y = state.heading
    player.visible = false
    $('wasted').classList.remove('show')
    toast('MEDICAL BILLS  -$500', '#ff5470')
  }, 2200)
}

function spawnPolice(initial = false) {
  if (state.police.length >= Math.min(3, state.wanted)) return
  const targetPos = state.mode === 'driving' ? state.carPos : state.onFootPos
  const angle = Math.random() * Math.PI * 2
  const dist = initial ? rnd(45, 65) : rnd(70, 110)
  let x = targetPos.x + Math.sin(angle) * dist
  let z = targetPos.z + Math.cos(angle) * dist
  x = clamp(x, -195, 195)
  z = clamp(z, -195, 195)
  const p = createCar('police')
  p.position.set(x, 0.02, z)
  const heading = Math.atan2(targetPos.x - x, targetPos.z - z)
  p.rotation.y = heading
  scene.add(p)
  state.police.push({ group: p, pos: new THREE.Vector3(x, 0.02, z), heading, speed: initial ? 10 : 15, shoot: rnd(0.8, 1.6), life: 0 })
  updateTargetList()
}

function rnd(a, b) { return a + Math.random() * (b - a) }

function findGroundHeight(x, z) {
  if (z > CITY.beachStart) return 0.06
  if (z > 196) return 0.11
  return 0.02
}

function resolveCircleCollision(pos, radius) {
  for (const c of city.colliders) {
    const nx = clamp(pos.x, c.minX, c.maxX)
    const nz = clamp(pos.z, c.minZ, c.maxZ)
    let dx = pos.x - nx
    let dz = pos.z - nz
    const d2 = dx * dx + dz * dz
    if (d2 < radius * radius) {
      let d = Math.sqrt(d2)
      if (d < 0.0001) {
        const toLeft = Math.abs(pos.x - c.minX)
        const toRight = Math.abs(c.maxX - pos.x)
        const toTop = Math.abs(pos.z - c.minZ)
        const toBottom = Math.abs(c.maxZ - pos.z)
        const min = Math.min(toLeft, toRight, toTop, toBottom)
        if (min === toLeft) pos.x = c.minX - radius
        else if (min === toRight) pos.x = c.maxX + radius
        else if (min === toTop) pos.z = c.minZ - radius
        else pos.z = c.maxZ + radius
      } else {
        dx /= d; dz /= d
        pos.x = nx + dx * radius
        pos.z = nz + dz * radius
      }
      return { nx: dx, nz: dz, hit: true }
    }
  }
  return { nx: 0, nz: 0, hit: false }
}

function forwardFromHeading(h, out = new THREE.Vector3()) {
  return out.set(Math.sin(h), 0, Math.cos(h))
}

function angleDelta(a, b) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function enterVehicle() {
  if (state.mode === 'driving') return
  const d = state.onFootPos.distanceTo(car.position)
  if (d > 6.2) { toast('GET CLOSER TO THE VEHICLE'); return }
  state.mode = 'driving'
  state.camYaw = state.heading
  state.orbitYaw = 0
  state.camPitch = 0.11
  player.visible = false
  document.body.classList.remove('on-foot')
  document.body.classList.add('driving')
$('btn-action').querySelector('span').textContent = 'EXIT'
$('btn-sprint').querySelector('span').textContent = 'BOOST'
  $('btn-action').querySelector('span').textContent = 'EXIT'
  $('btn-sprint').querySelector('span').textContent = 'BOOST'
  $('btn-jump').querySelector('span').textContent = 'JUMP'
  toast('INFERNUS  •  VICE EDITION', '#ff8b3d')
}

function exitVehicle() {
  if (state.mode !== 'driving') return
  if (Math.abs(state.speed) > 7) { toast('SLOW DOWN TO EXIT', '#ff5470'); return }
  state.mode = 'on-foot'
  state.vel.set(0, 0, 0)
  const right = tmpV.set(Math.cos(state.heading), 0, -Math.sin(state.heading))
  state.onFootPos.copy(car.position).addScaledVector(right, 2.3)
  state.onFootPos.y = findGroundHeight(state.onFootPos.x, state.onFootPos.z) + 0.14
  state.onFootVel.set(0, 0, 0)
  state.onFootHeading = state.heading
  state.camYaw = state.heading
  state.camPitch = 0.1
  player.visible = true
  player.position.copy(state.onFootPos)
  player.rotation.y = state.onFootHeading
  document.body.classList.remove('driving')
  document.body.classList.add('on-foot')
  $('btn-action').querySelector('span').textContent = 'ENTER'
  $('btn-sprint').querySelector('span').textContent = 'RUN'
  $('btn-jump').querySelector('span').textContent = 'JUMP'
  toast('ON FOOT', '#4ce6ff')
}

function toggleVehicle() {
  if (state.mode === 'driving') exitVehicle()
  else enterVehicle()
}

function addTracer(from, to, color = 0xffd9a0, life = 0.12) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()])
  const mat = tracerMat.clone()
  mat.color.setHex(color)
  mat.opacity = 0.95
  const line = new THREE.Line(geo, mat)
  line.frustumCulled = false
  scene.add(line)
  state.tracers.push({ line, life, max: life })
}

function spawnSpark(pos, color = 0xffc36b, count = 7, speed = 5) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: sparkTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    const sprite = new THREE.Sprite(mat)
    sprite.position.copy(pos)
    const s = rnd(0.12, 0.32)
    sprite.scale.set(s, s, 1)
    scene.add(sprite)
    state.particles.push({
      sprite, life: rnd(0.25, 0.55), max: 0.55,
      vel: new THREE.Vector3(rnd(-1, 1), rnd(0.2, 1.4), rnd(-1, 1)).normalize().multiplyScalar(speed * rnd(0.4, 1)),
      gravity: 6, kind: 'spark'
    })
  }
}

function spawnSmoke(pos, color = 0x9c8f88, size = 1) {
  const mat = new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.25, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.position.copy(pos)
  sprite.scale.set(size, size, 1)
  scene.add(sprite)
  state.particles.push({ sprite, life: rnd(0.5, 1.1), max: 1.1, vel: new THREE.Vector3(rnd(-0.4, 0.4), rnd(0.2, 0.8), rnd(-0.4, 0.4)), gravity: -0.4, kind: 'smoke' })
}

function shoot() {
  if (state.cooldown > 0) return
  const driving = state.mode === 'driving'
  state.cooldown = driving ? 0.16 : 0.105
  state.shake = Math.max(state.shake, driving ? 0.06 : 0.09)
  const muzzle = new THREE.Vector3()
  let dir = new THREE.Vector3()
  if (driving) {
    forwardFromHeading(state.heading, dir)
    muzzle.copy(car.position).addScaledVector(dir, 2.3)
    muzzle.y += 0.65
    spawnSpark(muzzle, 0xffcf87, 3, 3)
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: 0xffe2a4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    flash.position.copy(muzzle)
    flash.scale.set(1.1, 1.1, 1)
    scene.add(flash)
    state.particles.push({ sprite: flash, life: 0.08, max: 0.08, vel: new THREE.Vector3(), gravity: 0, kind: 'flash' })
  } else {
    camera.getWorldDirection(dir)
    const gunPos = new THREE.Vector3()
    player.userData.gun.getWorldPosition(gunPos)
    muzzle.copy(gunPos)
    flashMuzzle(player, state.time)
  }
  raycaster.set(driving ? muzzle : camera.position, dir)
  raycaster.far = 160
  const hits = raycaster.intersectObjects(targetMeshes, false)
  let point = muzzle.clone().addScaledVector(dir, 140)
  if (hits.length) {
    point.copy(hits[0].point)
    let obj = hits[0].object
    let ped = obj.userData.ped
    let traffic = null
    while (obj && !ped && !traffic) {
      if (obj.userData && obj.userData.ped) ped = obj.userData.ped
      if (obj.userData && obj.userData.traffic) traffic = obj.userData.traffic
      obj = obj.parent
    }
    if (ped && !ped.dead) {
      ped.dead = true
      addHeat(1.15)
      spawnSpark(point, 0xff5470, 10, 6)
      spawnSmoke(point, 0x5c1a28, 1.4)
      $('crosshair').classList.add('hit')
      setTimeout(() => $('crosshair').classList.remove('hit'), 120)
      setCash(state.cash + 25, 25)
      toast('CIVILIAN DOWN  +$25', '#ff5470')
    } else {
      spawnSpark(point, 0xffc36b, 6, 4)
      if (traffic) spawnSmoke(point, 0x5b5550, 1.2)
    }
  }
  addTracer(muzzle, point, driving ? 0xffb347 : 0xffd9a0, 0.09)
  audio.gunshot(driving)
  if (driving) addHeat(0.12)
}

function getInput() {
  let x = state.joystick.x
  let y = state.joystick.y
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }
}

function updateDriving(dt) {
  const input = getInput()
  let steerTarget = input.x
  if (state.tilt) steerTarget += state.tiltValue * 0.95
  steerTarget = clamp(steerTarget, -1, 1)
  state.steer = damp(state.steer, steerTarget, 8, dt)
  const throttle = input.y
  const fwd = forwardFromHeading(state.heading, tmpV)
  const right = tmpV2.set(Math.cos(state.heading), 0, -Math.sin(state.heading))
  let vF = state.vel.dot(fwd)
  let vS = state.vel.dot(right)
  const boost = state.boost
  if (throttle > 0.03) {
    vF += throttle * (boost ? 31 : 19) * dt
  } else if (throttle < -0.03) {
    if (vF > 0.2) vF += throttle * 34 * dt
    else vF += throttle * 9 * dt
  }
  vF *= Math.exp(-(boost ? 0.3 : 0.55) * dt)
  const maxSpeed = boost ? 48 : 39
  vF = clamp(vF, -13, maxSpeed)
  const grip = state.handbrake ? 0.7 : 5.6
  vS *= Math.exp(-grip * dt)
  const turn = state.steer * (0.65 + Math.min(Math.abs(vF) / 26, 1) * 1.15)
  state.heading += turn * dt * (vF >= 0 ? 1 : -1) * (state.handbrake ? 1.35 : 1)
  forwardFromHeading(state.heading, fwd)
  right.set(Math.cos(state.heading), 0, -Math.sin(state.heading))
  state.vel.copy(fwd).multiplyScalar(vF).addScaledVector(right, vS)
  state.carPos.addScaledVector(state.vel, dt)
  state.speed = vF

  const hit = resolveCircleCollision(state.carPos, 1.45)
  if (hit.hit) {
    const impact = Math.abs(vF)
    if (impact > 8) {
      spawnSpark(state.carPos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffc36b, 9, 5)
      state.shake = Math.max(state.shake, Math.min(0.35, impact * 0.012))
      vF *= 0.38
      vS *= 0.4
      state.vel.multiplyScalar(0.45)
    }
  }

  if (state.carPos.z > 250) {
    state.carPos.z = 250
    state.vel.multiplyScalar(0.7)
  }
  state.carPos.x = clamp(state.carPos.x, -205, 205)
  state.carPos.z = clamp(state.carPos.z, -205, 250)
  if (state.carPos.z > CITY.beachStart) state.vel.multiplyScalar(Math.exp(-1.2 * dt))

  car.position.copy(state.carPos)
  car.rotation.y = state.heading
  updateCarVisuals(car, dt, state.speed, state.steer, throttle < -0.05)

  for (const ped of city.peds) {
    if (ped.dead) continue
    const dx = ped.group.position.x - state.carPos.x
    const dz = ped.group.position.z - state.carPos.z
    if (dx * dx + dz * dz < 2.2) {
      ped.dead = true
      addHeat(1.5)
      spawnSpark(ped.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff5470, 9, 5)
      state.vel.multiplyScalar(0.88)
    }
  }

  if (state.speed > 8 && state.time - state.dustTimer > 0.08) {
    state.dustTimer = state.time
    const rear = tmpV3.copy(car.position).addScaledVector(fwd, -2)
    rear.y = 0.15
    spawnSmoke(rear, 0x9b8b80, 0.75)
  }
}

function updateOnFoot(dt) {
  const input = getInput()
  const yaw = state.camYaw
  const fwd = tmpV.set(Math.sin(yaw), 0, Math.cos(yaw))
  const right = tmpV2.set(Math.cos(yaw), 0, -Math.sin(yaw))
  const desired = tmpV3.set(0, 0, 0).addScaledVector(fwd, input.y).addScaledVector(right, input.x)
  if (desired.lengthSq() > 1) desired.normalize()
  const sprint = state.sprintHeld || keys.has('ShiftLeft') || keys.has('ShiftRight')
  const speed = sprint ? 7.2 : 4.35
  state.onFootVel.x = damp(state.onFootVel.x, desired.x * speed, 10, dt)
  state.onFootVel.z = damp(state.onFootVel.z, desired.z * speed, 10, dt)
  if (desired.lengthSq() < 0.02) {
    state.onFootVel.x = damp(state.onFootVel.x, 0, 14, dt)
    state.onFootVel.z = damp(state.onFootVel.z, 0, 14, dt)
  }
  state.onFootPos.x += state.onFootVel.x * dt
  state.onFootPos.z += state.onFootVel.z * dt
  const hit = resolveCircleCollision(state.onFootPos, 0.48)
  if (hit.hit) {
    state.onFootVel.x *= 0.1
    state.onFootVel.z *= 0.1
  }
  state.onFootPos.x = clamp(state.onFootPos.x, -207, 207)
  state.onFootPos.z = clamp(state.onFootPos.z, -207, 252)
  const ground = findGroundHeight(state.onFootPos.x, state.onFootPos.z)
  if (!state.onGround) {
    state.onFootVel.y -= 24 * dt
    state.onFootPos.y += state.onFootVel.y * dt
    if (state.onFootPos.y <= ground + 0.14) {
      state.onFootPos.y = ground + 0.14
      state.onFootVel.y = 0
      state.onGround = true
    }
  } else {
    state.onFootPos.y = damp(state.onFootPos.y, ground + 0.14, 18, dt)
    if (state.jumpHeld) {
      state.onFootVel.y = 7.4
      state.onGround = false
      state.jumpHeld = false
    }
  }

  const moveSpeed = Math.hypot(state.onFootVel.x, state.onFootVel.z)
  let face = yaw
  if (moveSpeed > 0.3 && !state.fireHeld) face = Math.atan2(state.onFootVel.x, state.onFootVel.z)
  if (state.fireHeld) face = yaw
  state.onFootHeading += angleDelta(state.onFootHeading, face) * Math.min(1, 14 * dt)
  player.position.copy(state.onFootPos)
  player.rotation.y = state.onFootHeading
  animatePlayer(player, state.time, moveSpeed, state.fireHeld, !state.onGround)
  if (state.fire && state.cooldown <= 0) shoot()
}

function updateCamera(dt) {
  const speedRatio = clamp(Math.abs(state.speed) / 42, 0, 1)
  if (state.mode === 'driving') {
    if (!state.lookActive) state.orbitYaw = damp(state.orbitYaw, 0, 2.2, dt)
    const yaw = state.heading + state.orbitYaw
    const fwd = tmpV.set(Math.sin(yaw), 0, Math.cos(yaw))
    const portrait = isTouch && innerHeight > innerWidth
    const dist = (portrait ? 9.8 : 8.4) + speedRatio * 2.2
    const height = (portrait ? 4.9 : 4.1) + Math.sin(state.camPitch) * 3.2 + speedRatio * 0.3
    const desired = tmpV2.copy(state.carPos).addScaledVector(fwd, -dist)
    desired.y = state.carPos.y + height
    const look = tmpV3.copy(state.carPos).addScaledVector(fwd, portrait ? 10 : 7.5)
    look.y = state.carPos.y + 1.2
    state.camPos.lerp(desired, 1 - Math.exp(-7 * dt))
    state.camLook.lerp(look, 1 - Math.exp(-8 * dt))
    camera.position.copy(state.camPos)
    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake
      camera.position.y += (Math.random() - 0.5) * state.shake
      state.shake = Math.max(0, state.shake - dt * 1.8)
    }
    camera.lookAt(state.camLook)
    const targetFov = (isTouch && innerHeight > innerWidth ? 69 : 62) + speedRatio * 9
    camera.fov = damp(camera.fov, targetFov, 4, dt)
    camera.updateProjectionMatrix()
  } else {
    const yaw = state.camYaw
    const fwd = tmpV.set(Math.sin(yaw), 0, Math.cos(yaw))
    const right = tmpV2.set(Math.cos(yaw), 0, -Math.sin(yaw))
    const aiming = state.fireHeld
    const dist = aiming ? 3.6 : 5.3
    const desired = tmpV3.copy(state.onFootPos).addScaledVector(fwd, -dist * Math.cos(state.camPitch))
    desired.y = state.onFootPos.y + 1.55 + Math.sin(state.camPitch) * dist
    if (aiming) desired.addScaledVector(right, 0.75)
    const look = new THREE.Vector3().copy(state.onFootPos).addScaledVector(fwd, 7)
    look.y = state.onFootPos.y + 1.32 + Math.sin(state.camPitch) * 4
    state.camPos.lerp(desired, 1 - Math.exp(-10 * dt))
    state.camLook.lerp(look, 1 - Math.exp(-12 * dt))
    camera.position.copy(state.camPos)
    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake
      camera.position.y += (Math.random() - 0.5) * state.shake
      state.shake = Math.max(0, state.shake - dt * 1.8)
    }
    camera.lookAt(state.camLook)
    camera.fov = damp(camera.fov, isTouch && innerHeight > innerWidth ? 69 : 62, 4, dt)
    camera.updateProjectionMatrix()
  }
}

function updatePolice(dt) {
  if (state.wanted === 0 && state.police.length) {
    for (const p of state.police) p.life += dt
    if (state.police.every(p => p.life > 8)) {
      for (const p of state.police) scene.remove(p.group)
      state.police.length = 0
      updateTargetList()
    }
  }
  if (state.wanted > 0) {
    state.policeTimer -= dt
    if (state.policeTimer <= 0 && state.police.length < Math.min(3, state.wanted)) {
      spawnPolice()
      state.policeTimer = rnd(5, 9)
    }
  }
  const target = state.mode === 'driving' ? state.carPos : state.onFootPos
  for (const p of state.police) {
    if (state.wanted === 0) {
      p.speed = damp(p.speed, 0, 1, dt)
      updateCarVisuals(p.group, dt, p.speed, 0, false)
      continue
    }
    p.life += dt
    const dx = target.x - p.pos.x
    const dz = target.z - p.pos.z
    const dist = Math.hypot(dx, dz)
    const desired = Math.atan2(dx, dz)
    p.heading += clamp(angleDelta(p.heading, desired), -1.8 * dt, 1.8 * dt)
    const targetSpeed = dist < 18 ? 8 : Math.min(24, 12 + state.wanted * 2)
    p.speed = damp(p.speed, targetSpeed, 1.2, dt)
    const fwd = forwardFromHeading(p.heading, tmpV)
    p.pos.addScaledVector(fwd, p.speed * dt)
    const hit = resolveCircleCollision(p.pos, 1.4)
    if (hit.hit) p.speed *= 0.5
    p.pos.x = clamp(p.pos.x, -205, 205)
    p.pos.z = clamp(p.pos.z, -205, 250)
    p.group.position.copy(p.pos)
    p.group.rotation.y = p.heading
    updateCarVisuals(p.group, dt, p.speed, 0, false)
    p.shoot -= dt
    if (dist < 46 && p.shoot <= 0) {
      p.shoot = rnd(1.2, 2.1)
      const from = p.pos.clone()
      from.y += 0.85
      const to = target.clone()
      to.y += state.mode === 'driving' ? 0.8 : 1.25
      addTracer(from, to, 0x7fc9ff, 0.14)
      spawnSpark(to, 0x8ed8ff, 3, 3)
      damagePlayer(rnd(3.5, 7))
    }
  }
}

function updateMission(dt) {
  const m = state.mission
  m.timer -= dt
  if (m.timer <= 0) {
    m.timer = m.total
    m.index = (m.index + 1) % MISSION_POINTS.length
    m.target.copy(MISSION_POINTS[m.index])
    m.startDist = (state.mode === 'driving' ? state.carPos : state.onFootPos).distanceTo(m.target)
    city.setTarget(m.target.x, m.target.z)
    toast('TIME EXPIRED  •  NEW DROP-OFF', '#ff5470')
    return
  }
  const pos = state.mode === 'driving' ? state.carPos : state.onFootPos
  m.distance = pos.distanceTo(m.target)
  if (m.distance < 5.2) {
    const reward = 500 + Math.round((m.timer / m.total) * 750)
    setCash(state.cash + reward, reward)
    toast(`DROP-OFF COMPLETE  +$${reward.toLocaleString('en-US')}`, '#c8ff5c')
    m.index = (m.index + 1) % MISSION_POINTS.length
    m.target.copy(MISSION_POINTS[m.index])
    m.timer = Math.min(m.total, m.timer + 35)
    m.startDist = pos.distanceTo(m.target)
    city.setTarget(m.target.x, m.target.z)
    audio.chime()
  }
}

const MISSION_POINTS = [
  new THREE.Vector3(0, 0, 202),
  new THREE.Vector3(-128, 0, 0),
  new THREE.Vector3(128, 0, -64),
  new THREE.Vector3(0, 0, -160),
  new THREE.Vector3(160, 0, 128),
  new THREE.Vector3(-64, 0, 160),
  new THREE.Vector3(64, 0, 32)
]

function updateHUD() {
  const pos = state.mode === 'driving' ? state.carPos : state.onFootPos
  const m = state.mission
  m.distance = pos.distanceTo(m.target)
  $('mission-distance').textContent = Math.round(m.distance) + ' M'
  const mm = Math.floor(Math.max(0, m.timer) / 60).toString().padStart(2, '0')
  const ss = Math.floor(Math.max(0, m.timer) % 60).toString().padStart(2, '0')
  $('mission-timer').textContent = `${mm}:${ss}`
  const progress = clamp(1 - m.distance / Math.max(1, m.startDist), 0, 1)
  $('mission-progress-fill').style.width = (progress * 100).toFixed(1) + '%'
  $('health-fill').style.width = state.health + '%'
  $('armor-fill').style.width = state.armor + '%'
  const mph = Math.round(Math.abs(state.speed) * 2.237)
  $('speed-value').textContent = mph
  const p = clamp(Math.abs(state.speed) / 44, 0, 1)
  $('speed-arc').style.strokeDasharray = `${Math.max(0.01, p * 310)} 415`
  $('speed-arc').style.stroke = p > 0.78 ? '#ff3d7f' : p > 0.45 ? '#ffb347' : '#4ce6ff'
  $('gear').textContent = state.speed < -0.5 ? 'R' : Math.abs(state.speed) < 0.4 ? 'N' : 'D'
}

function drawMinimap() {
  const canvas = $('minimap')
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const cx = w / 2
  const cy = h / 2
  const pos = state.mode === 'driving' ? state.carPos : state.onFootPos
  const heading = state.mode === 'driving' ? state.heading : state.camYaw
  const scale = 2.35
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, w / 2, 0, Math.PI * 2)
  ctx.clip()
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#112034')
  bg.addColorStop(1, '#09111f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.translate(cx, cy)
  ctx.rotate(-heading)
  ctx.scale(1, 1)

  const wx = (x) => (x - pos.x) * scale
  const wy = (z) => -(z - pos.z) * scale

  ctx.fillStyle = '#17324a'
  ctx.fillRect(-1200, wy(268), 2400, 1400)
  ctx.fillStyle = '#5d4937'
  ctx.fillRect(-1200, wy(204), 2400, (268 - 204) * scale)

  ctx.fillStyle = '#151f2e'
  for (const x of CITY.centers) {
    for (const z of CITY.centers) {
      ctx.fillRect(wx(x - 25), wy(z + 25), 50 * scale, 50 * scale)
    }
  }
  ctx.strokeStyle = '#31465d'
  ctx.lineWidth = 8
  for (const road of CITY.roads) {
    ctx.beginPath()
    ctx.moveTo(wx(road), wy(-210))
    ctx.lineTo(wx(road), wy(210))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(wx(-210), wy(road))
    ctx.lineTo(wx(210), wy(road))
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,200,120,.36)'
  ctx.lineWidth = 1.5
  for (const road of CITY.roads) {
    ctx.beginPath()
    ctx.moveTo(wx(road), wy(-210))
    ctx.lineTo(wx(road), wy(210))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(wx(-210), wy(road))
    ctx.lineTo(wx(210), wy(road))
    ctx.stroke()
  }
  ctx.fillStyle = '#25384a'
  for (const b of city.blocks) {
    if (b.type === 'park') ctx.fillStyle = '#254f36'
    else if (b.type === 'parking') ctx.fillStyle = '#202633'
    else ctx.fillStyle = '#26384a'
    ctx.fillRect(wx(b.x - 20), wy(b.z + 20), 40 * scale, 40 * scale)
  }

  const blip = (x, z, color, size = 5) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(wx(x), wy(z), size, 0, Math.PI * 2)
    ctx.fill()
  }
  for (const t of city.traffic) blip(t.group.position.x, t.group.position.z, 'rgba(255,255,255,.34)', 2)
  for (const p of state.police) blip(p.pos.x, p.pos.z, '#6fb6ff', 4)
  for (const ped of city.peds) if (!ped.dead && Math.abs(ped.group.position.x - pos.x) < 80 && Math.abs(ped.group.position.z - pos.z) < 80) blip(ped.group.position.x, ped.group.position.z, 'rgba(255,255,255,.22)', 1.6)

  let dx = (state.mission.target.x - pos.x) * scale
  let dz = -(state.mission.target.z - pos.z) * scale
  const blipLen = Math.hypot(dx, dz)
  const blipMax = w / 2 - 17
  if (blipLen > blipMax) { dx = dx / blipLen * blipMax; dz = dz / blipLen * blipMax }
  ctx.save()
  ctx.translate(dx, dz)
  ctx.fillStyle = '#ffb347'
  ctx.shadowColor = '#ffb347'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff4df'
  ctx.beginPath()
  ctx.arc(0, 0, 2.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.restore()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = '#fff4df'
  ctx.strokeStyle = '#0b0a16'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -9)
  ctx.lineTo(6.5, 7)
  ctx.lineTo(0, 3.6)
  ctx.lineTo(-6.5, 7)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]
    p.life -= dt
    if (p.life <= 0) {
      scene.remove(p.sprite)
      p.sprite.material.dispose()
      state.particles.splice(i, 1)
      continue
    }
    p.vel.y -= p.gravity * dt
    p.sprite.position.addScaledVector(p.vel, dt)
    const t = p.life / p.max
    if (p.kind === 'spark') p.sprite.material.opacity = t
    else if (p.kind === 'smoke') {
      p.sprite.material.opacity = 0.22 * t
      const s = p.sprite.scale.x + dt * 1.6
      p.sprite.scale.set(s, s, 1)
    }
  }
  for (let i = state.tracers.length - 1; i >= 0; i--) {
    const t = state.tracers[i]
    t.life -= dt
    if (t.life <= 0) {
      scene.remove(t.line)
      t.line.geometry.dispose()
      t.line.material.dispose()
      state.tracers.splice(i, 1)
      continue
    }
    t.line.material.opacity = t.life / t.max
  }
}

function updateAudioState() {
  audio.engine(state.mode === 'driving' ? Math.abs(state.speed) : 0, state.mode === 'driving')
  audio.siren(state.wanted > 0 && state.police.length > 0, state.time)
}

class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.engineGain = null
    this.engineOsc = null
    this.engineOsc2 = null
    this.filter = null
    this.sirenGain = null
    this.sirenOsc = null
    this.started = false
    this.noise = null
  }
  start() {
    if (this.started) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = state.muted ? 0 : 0.55
    this.master.connect(this.ctx.destination)
    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 520
    this.engineGain = this.ctx.createGain()
    this.engineGain.gain.value = 0
    this.filter.connect(this.engineGain)
    this.engineGain.connect(this.master)
    this.engineOsc = this.ctx.createOscillator()
    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 48
    this.engineOsc.connect(this.filter)
    this.engineOsc.start()
    this.engineOsc2 = this.ctx.createOscillator()
    this.engineOsc2.type = 'square'
    this.engineOsc2.frequency.value = 96
    const g2 = this.ctx.createGain()
    g2.gain.value = 0.18
    this.engineOsc2.connect(g2)
    g2.connect(this.filter)
    this.engineOsc2.start()
    this.sirenGain = this.ctx.createGain()
    this.sirenGain.gain.value = 0
    this.sirenGain.connect(this.master)
    this.sirenOsc = this.ctx.createOscillator()
    this.sirenOsc.type = 'sine'
    this.sirenOsc.frequency.value = 760
    this.sirenOsc.connect(this.sirenGain)
    this.sirenOsc.start()
    const len = this.ctx.sampleRate * 0.2
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    this.started = true
  }
  resume() {
    this.start()
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  }
  setMuted(muted) {
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05)
  }
  engine(speed, driving) {
    if (!this.started) return
    const t = this.ctx.currentTime
    const f = 42 + Math.min(speed, 45) * 2.2
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.06)
    this.engineOsc2.frequency.setTargetAtTime(f * 2.02, t, 0.06)
    this.filter.frequency.setTargetAtTime(260 + speed * 18, t, 0.08)
    this.engineGain.gain.setTargetAtTime(driving ? 0.035 + Math.min(speed, 40) * 0.0012 : 0, t, 0.1)
  }
  siren(on, time) {
    if (!this.started) return
    const t = this.ctx.currentTime
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, t, 0.1)
    if (on) this.sirenOsc.frequency.setTargetAtTime(680 + Math.sin(time * 7) * 260, t, 0.04)
  }
  gunshot(driving) {
    if (!this.started) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const g = this.ctx.createGain()
    g.gain.value = driving ? 0.1 : 0.18
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = driving ? 900 : 1500
    f.Q.value = 0.7
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
  }
  chime() {
    if (!this.started) return
    const t = this.ctx.currentTime
    ;[660, 880, 1320].forEach((freq, i) => {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t + i * 0.07)
      g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.07 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.26)
      o.connect(g)
      g.connect(this.master)
      o.start(t + i * 0.07)
      o.stop(t + i * 0.07 + 0.3)
    })
  }
}
const audio = new AudioEngine()

function startAudioOnce() {
  audio.resume()
  window.removeEventListener('pointerdown', startAudioOnce)
  window.removeEventListener('keydown', startAudioOnce)
}

function setupInput() {
  window.addEventListener('pointerdown', startAudioOnce, { passive: true })
  window.addEventListener('keydown', startAudioOnce)

  const canvas = $('scene')
  canvas.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement === canvas) {
      state.fire = true
      state.fireHeld = true
    } else if (!('ontouchstart' in window)) {
      canvas.requestPointerLock?.()
    }
  })
  window.addEventListener('mouseup', () => { state.fire = false; state.fireHeld = false })
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      if (state.mode === 'on-foot') {
        state.camYaw -= e.movementX * 0.0022
        state.camPitch = clamp(state.camPitch - e.movementY * 0.0016, -0.35, 0.65)
      } else {
        state.orbitYaw = clamp(state.orbitYaw - e.movementX * 0.003, -1.3, 1.3)
        state.camPitch = clamp(state.camPitch - e.movementY * 0.0012, -0.2, 0.55)
        state.lookActive = true
        clearTimeout(state.lookTimer)
        state.lookTimer = setTimeout(() => { state.lookActive = false }, 700)
      }
    }
  })
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) { state.fire = false; state.fireHeld = false }
  })

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    if (e.repeat) return
    keys.add(e.code)
    if (e.code === 'KeyE') toggleVehicle()
    if (e.code === 'KeyF') { state.fire = true; state.fireHeld = true }
    if (e.code === 'KeyM') toggleSound()
    if (e.code === 'KeyT') toggleTilt()
    if (e.code === 'KeyR') resetCar()
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.boost = true
    if (e.code === 'Space') {
      if (state.mode === 'driving') state.handbrake = true
      else state.jumpHeld = true
    }
  })
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code)
    if (e.code === 'KeyF') { state.fire = false; state.fireHeld = false }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.boost = false
    if (e.code === 'Space') state.handbrake = false
  })

  const stickZone = $('stick-zone')
  const stickBase = $('stick-base')
  const stickKnob = $('stick-knob')
  let stickId = null
  let stickRect = null
  const updateStick = (e) => {
    const dx = e.clientX - (stickRect.left + stickRect.width / 2)
    const dy = e.clientY - (stickRect.top + stickRect.height / 2)
    const radius = 44
    const len = Math.hypot(dx, dy)
    const k = len > radius ? radius / len : 1
    const x = dx * k
    const y = dy * k
    state.joystick.x = x / radius
    state.joystick.y = -y / radius
    stickKnob.style.transform = `translate(${x}px, ${y}px)`
  }
  stickZone.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId
    stickRect = stickBase.getBoundingClientRect()
    stickZone.setPointerCapture(e.pointerId)
    updateStick(e)
    e.preventDefault()
  })
  stickZone.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) updateStick(e) })
  const endStick = (e) => {
    if (e.pointerId !== stickId) return
    stickId = null
    state.joystick.x = 0
    state.joystick.y = 0
    stickKnob.style.transform = 'translate(0,0)'
  }
  stickZone.addEventListener('pointerup', endStick)
  stickZone.addEventListener('pointercancel', endStick)

  const lookZone = $('look-zone')
  let lookId = null
  let lastX = 0
  let lastY = 0
  lookZone.addEventListener('pointerdown', (e) => {
    lookId = e.pointerId
    lastX = e.clientX
    lastY = e.clientY
    lookZone.setPointerCapture(e.pointerId)
    state.lookActive = true
    e.preventDefault()
  })
  lookZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    if (state.mode === 'on-foot') {
      state.camYaw -= dx * 0.006
      state.camPitch = clamp(state.camPitch + dy * 0.004, -0.35, 0.65)
    } else {
      state.orbitYaw = clamp(state.orbitYaw - dx * 0.007, -1.35, 1.35)
      state.camPitch = clamp(state.camPitch + dy * 0.003, -0.2, 0.55)
    }
  })
  const endLook = (e) => {
    if (e.pointerId !== lookId) return
    lookId = null
    state.lookActive = false
  }
  lookZone.addEventListener('pointerup', endLook)
  lookZone.addEventListener('pointercancel', endLook)

  const fireBtn = $('btn-fire')
  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    state.fire = true
    state.fireHeld = true
    startAudioOnce()
  })
  const endFire = (e) => { e.preventDefault(); state.fire = false; state.fireHeld = false }
  fireBtn.addEventListener('pointerup', endFire)
  fireBtn.addEventListener('pointercancel', endFire)
  fireBtn.addEventListener('pointerleave', endFire)

  $('btn-action').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleVehicle(); startAudioOnce() })
  const sprintBtn = $('btn-sprint')
  sprintBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation()
    if (state.mode === 'driving') state.boost = true
    else state.sprintHeld = true
    sprintBtn.classList.add('active')
    startAudioOnce()
  })
  const endSprint = () => { state.boost = false; state.sprintHeld = false; sprintBtn.classList.remove('active') }
  sprintBtn.addEventListener('pointerup', endSprint)
  sprintBtn.addEventListener('pointercancel', endSprint)
  sprintBtn.addEventListener('pointerleave', endSprint)
  const jumpBtn = $('btn-jump')
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation()
    if (state.mode === 'driving') state.handbrake = true
    else state.jumpHeld = true
    startAudioOnce()
  })
  jumpBtn.addEventListener('pointerup', () => { state.handbrake = false })

  $('btn-tilt').addEventListener('click', (e) => { e.preventDefault(); toggleTilt() })
  $('btn-sound').addEventListener('click', (e) => { e.preventDefault(); toggleSound() })

  window.addEventListener('blur', () => {
    keys.clear()
    state.joystick.x = 0
    state.joystick.y = 0
    state.fire = false
    state.fireHeld = false
    state.boost = false
    state.sprintHeld = false
  })
}

function resetCar() {
  if (state.mode !== 'driving') return
  state.carPos.set(CITY.start.x, 0.02, CITY.start.z)
  state.heading = CITY.start.heading
  state.vel.set(0, 0, 0)
  state.speed = 0
  state.steer = 0
  car.position.copy(state.carPos)
  car.rotation.y = state.heading
  toast('VEHICLE RESET', '#4ce6ff')
}

function toggleSound() {
  state.muted = !state.muted
  audio.start()
  audio.setMuted(state.muted)
  $('btn-sound').classList.toggle('muted', state.muted)
  toast(state.muted ? 'AUDIO OFF' : 'AUDIO ON', state.muted ? '#ff5470' : '#4ce6ff')
}

async function toggleTilt() {
  if (state.tilt) {
    state.tilt = false
    state.tiltValue = 0
    $('btn-tilt').classList.remove('on')
    $('btn-tilt').querySelector('span').textContent = 'TILT OFF'
    toast('TILT STEERING OFF', '#4ce6ff')
    return
  }
  const DOE = window.DeviceOrientationEvent
  if (!DOE) {
    toast('MOTION SENSOR NOT AVAILABLE', '#ff5470')
    return
  }
  try {
    if (typeof DOE.requestPermission === 'function') {
      const permission = await DOE.requestPermission()
      if (permission !== 'granted') {
        toast('MOTION ACCESS DENIED', '#ff5470')
        return
      }
    }
  } catch (error) {
    toast('MOTION ACCESS DENIED', '#ff5470')
    return
  }
  state.tilt = true
  state.tiltSeen = false
  state.tiltBaseline = null
  $('btn-tilt').classList.add('on')
  $('btn-tilt').querySelector('span').textContent = 'TILT ON'
  toast('TILT STEERING ON  •  HOLD LEVEL', '#4ce6ff')
  setTimeout(() => {
    if (state.tilt && !state.tiltSeen) toast('NO MOTION DATA ON THIS DEVICE', '#ff5470')
  }, 1600)
}

function handleOrientation(e) {
  if (!state.tilt) return
  if (e.gamma == null && e.beta == null) return
  state.tiltSeen = true
  const angle = screen.orientation?.angle || window.orientation || 0
  let raw
  if (angle === 90) raw = -(e.beta || 0)
  else if (angle === -90 || angle === 270) raw = e.beta || 0
  else raw = e.gamma || 0
  if (state.tiltBaseline == null) state.tiltBaseline = raw
  const v = clamp((raw - state.tiltBaseline) / 22, -1, 1)
  state.tiltValue = Math.abs(v) < 0.06 ? 0 : v
}
window.addEventListener('deviceorientation', handleOrientation)

function resize() {
  camera.aspect = innerWidth / innerHeight
  camera.fov = isTouch && innerHeight > innerWidth ? 69 : 62
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  const pr = Math.min(devicePixelRatio, isTouch ? 1.25 : 2)
  renderer.setPixelRatio(pr)
  renderer.setSize(innerWidth, innerHeight)
  if (composer) {
    composer.setPixelRatio(Math.min(devicePixelRatio, 1.7))
    composer.setSize(innerWidth, innerHeight)
    fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr))
  }
}
window.addEventListener('resize', resize)

let last = performance.now()
let hudTimer = 0
let minimapTimer = 0
let started = false

function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  state.time += dt
  state.cooldown = Math.max(0, state.cooldown - dt)
  if (state.mode === 'driving') updateDriving(dt)
  else updateOnFoot(dt)
  updatePolice(dt)
  updateMission(dt)
  updateCamera(dt)
  updateParticles(dt)
  city.update(dt, state.time, state.mode === 'driving' ? state.carPos : state.onFootPos)
  if (state.mode === 'driving' && state.fire && state.cooldown <= 0) shoot()
  updateAudioState()
  if (state.time - state.lastDamage > 8 && state.health < 100) state.health = Math.min(100, state.health + dt * 2.2)
  if (state.time - state.lastCrime > 26) {
    state.heat = Math.max(0, state.heat - dt * 0.045)
    const wanted = Math.min(5, Math.ceil(state.heat))
    if (wanted !== state.wanted) { state.wanted = wanted; updateWantedUI() }
  }
  hudTimer += dt
  if (hudTimer > 0.08) {
    hudTimer = 0
    updateHUD()
    drawMinimap()
  }
  if (composer) composer.render()
  else renderer.render(scene, camera)
  if (!started) {
    started = true
    document.body.classList.add('ready')
    setTimeout(() => $('splash').classList.add('hide'), 180)
  }
  requestAnimationFrame(loop)
}

setCash(state.cash)
updateWantedUI()
setupInput()
resize()
requestAnimationFrame(loop)

window.__game = { state, car, camera, city, scene, renderer, player, composer, bloom, lowQuality, targetMeshes, THREE }

window.addEventListener('load', () => {
  setTimeout(() => {
    if (!started) document.body.classList.add('ready')
  }, 1200)
})
