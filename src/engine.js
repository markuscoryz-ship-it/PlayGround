import * as THREE from 'three';
import { QUALITY, TAU, clamp, smoothstep, worldRandom, touchUi } from './config.js';
import { ui } from './dom.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 640);
camera.position.set(0, 13, 28);

export const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: QUALITY === 'high',
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(QUALITY === 'high' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = QUALITY === 'high';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const raycaster = new THREE.Raycaster();
export const tempVec = new THREE.Vector3();
export const tempVec2 = new THREE.Vector3();

scene.fog = new THREE.Fog(0x9e9e84, 42, QUALITY === 'low' ? 178 : 255);

const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color(0x354f58) },
    bottomColor: { value: new THREE.Color(0xd49a68) },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;
    void main() {
      vec3 dir = normalize(vWorldPosition + vec3(0.0, 12.0, 0.0));
      float horizon = pow(clamp(dir.y * 1.25 + 0.03, 0.0, 1.0), 0.62);
      vec3 col = mix(bottomColor, topColor, horizon);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(470, 24, 14), skyMaterial));

const starPositions = [];
for (let i = 0; i < 420; i += 1) {
  const theta = worldRandom() * TAU;
  const phi = Math.acos(0.03 + worldRandom() * 0.94);
  const radius = 410;
  starPositions.push(
    Math.sin(phi) * Math.cos(theta) * radius,
    Math.cos(phi) * radius,
    Math.sin(phi) * Math.sin(theta) * radius,
  );
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({
  color: 0xdde6dc,
  size: 1.15,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  fog: false,
});
export const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,245,210,1)');
  gradient.addColorStop(0.16, 'rgba(255,213,143,0.9)');
  gradient.addColorStop(0.42, 'rgba(255,173,93,0.26)');
  gradient.addColorStop(1, 'rgba(255,143,80,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture(),
  color: 0xffe4b2,
  transparent: true,
  opacity: 0.8,
  depthWrite: false,
  fog: false,
  blending: THREE.AdditiveBlending,
}));
sunSprite.scale.set(78, 78, 1);
scene.add(sunSprite);

const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
const cloudMaterial = new THREE.MeshBasicMaterial({
  color: 0xe5e0cc,
  transparent: true,
  opacity: 0.14,
  depthWrite: false,
  fog: false,
});
const cloudMesh = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 15);
cloudMesh.frustumCulled = false;
const cloudDummy = new THREE.Object3D();
const cloudData = [];
for (let i = 0; i < 15; i += 1) {
  const angle = (i / 15) * TAU + worldRandom() * 0.32;
  const radius = 115 + worldRandom() * 95;
  const data = {
    x: Math.cos(angle) * radius,
    y: 45 + worldRandom() * 32,
    z: Math.sin(angle) * radius,
    sx: 8 + worldRandom() * 14,
    sy: 2.2 + worldRandom() * 3.4,
    sz: 5 + worldRandom() * 8,
    drift: 0.12 + worldRandom() * 0.22,
  };
  cloudData.push(data);
  cloudDummy.position.set(data.x, data.y, data.z);
  cloudDummy.scale.set(data.sx, data.sy, data.sz);
  cloudDummy.rotation.y = worldRandom() * TAU;
  cloudDummy.updateMatrix();
  cloudMesh.setMatrixAt(i, cloudDummy.matrix);
}
cloudMesh.instanceMatrix.needsUpdate = true;
scene.add(cloudMesh);

export const hemiLight = new THREE.HemisphereLight(0x9eb7b3, 0x3a402c, 1.35);
scene.add(hemiLight);

export const ambientLight = new THREE.AmbientLight(0x6d745f, 0.38);
scene.add(ambientLight);

export const sunLight = new THREE.DirectionalLight(0xffd29b, 1.75);
sunLight.position.set(-55, 65, 20);
sunLight.castShadow = QUALITY === 'high';
if (QUALITY === 'high') {
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -88;
  sunLight.shadow.camera.right = 88;
  sunLight.shadow.camera.top = 88;
  sunLight.shadow.camera.bottom = -88;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.025;
}
sunLight.target.position.set(0, 0, -8);
scene.add(sunLight);
scene.add(sunLight.target);

const nightTop = new THREE.Color(0x07111b);
const nightBottom = new THREE.Color(0x1a2630);
const dayTop = new THREE.Color(0x4f747a);
const dayBottom = new THREE.Color(0xd5c9ac);
const duskTop = new THREE.Color(0x654e5d);
const duskBottom = new THREE.Color(0xe19a63);
const sunWarm = new THREE.Color(0xffb06b);
const sunWhite = new THREE.Color(0xfff1cf);
const fogTint = new THREE.Color(0x5a5d4f);
const topColor = new THREE.Color();
const bottomColor = new THREE.Color();
const fogColor = new THREE.Color();
const starColor = new THREE.Color(0xdde6dc);

export function updateEnvironment(gameHour, elapsed) {
  const hour = ((gameHour % 24) + 24) % 24;
  const timeOfDay = hour / 24;
  const angle = (timeOfDay - 0.25) * TAU;
  const elevation = Math.sin(angle);
  const day = smoothstep(-0.12, 0.22, elevation);
  const dusk = clamp(1 - Math.abs(elevation) * 3.6, 0, 1);

  topColor.copy(nightTop).lerp(dayTop, day);
  topColor.lerp(duskTop, dusk * 0.7);
  bottomColor.copy(nightBottom).lerp(dayBottom, day);
  bottomColor.lerp(duskBottom, dusk * 0.76);

  skyMaterial.uniforms.topColor.value.copy(topColor);
  skyMaterial.uniforms.bottomColor.value.copy(bottomColor);

  fogColor.copy(bottomColor).lerp(fogTint, 0.14);
  scene.fog.color.copy(fogColor);
  scene.fog.near = QUALITY === 'low' ? 31 : 44;
  scene.fog.far = (QUALITY === 'low' ? 172 : 252) * (0.72 + day * 0.28);

  starMaterial.opacity = clamp(-elevation * 2.8, 0, 1) * 0.9;
  starColor.setHex(0xdde6dc);
  starMaterial.color.copy(starColor);
  stars.rotation.y = elapsed * 0.004;

  sunSprite.position.set(Math.cos(angle) * 415, elevation * 415, Math.sin(angle) * 415 - 8);
  sunSprite.material.opacity = clamp(elevation * 2.4, 0, 1) * 0.86;
  sunSprite.scale.setScalar(66 + dusk * 34);

  sunLight.position.set(
    Math.cos(angle) * 110,
    Math.max(-20, elevation * 105),
    Math.sin(angle) * 88 - 8,
  );
  sunLight.intensity = 0.08 + day * 1.9;
  sunLight.color.copy(sunWarm).lerp(sunWhite, smoothstep(0.02, 0.48, elevation));

  hemiLight.intensity = 0.2 + day * 1.18;
  hemiLight.color.copy(topColor).lerp(new THREE.Color(0xffffff), 0.22);
  hemiLight.groundColor.setHex(0x353c2b).lerp(new THREE.Color(0x5b6650), day);
  ambientLight.intensity = 0.13 + day * 0.28;

  cloudMaterial.opacity = 0.025 + day * 0.15;
  cloudMaterial.color.copy(nightTop).lerp(new THREE.Color(0xe5e0cc), day);

  renderer.toneMappingExposure = 0.91 + day * 0.16 + (touchUi ? 0.04 : 0);
}

export function animateClouds(elapsed) {
  for (let i = 0; i < cloudData.length; i += 1) {
    const cloud = cloudData[i];
    cloudDummy.position.set(
      cloud.x + Math.sin(elapsed * 0.017 + i) * 8,
      cloud.y + Math.sin(elapsed * 0.05 + i * 1.7) * 0.8,
      cloud.z + Math.cos(elapsed * 0.013 + i) * 8,
    );
    cloudDummy.scale.set(cloud.sx, cloud.sy, cloud.sz);
    cloudDummy.rotation.y = elapsed * 0.006 + i;
    cloudDummy.updateMatrix();
    cloudMesh.setMatrixAt(i, cloudDummy.matrix);
  }
  cloudMesh.instanceMatrix.needsUpdate = true;
}

export function resizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(QUALITY === 'high' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
  renderer.setSize(width, height, false);
}
