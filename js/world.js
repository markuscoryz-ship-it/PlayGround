import * as THREE from 'three';
import {
  mulberry32, clamp, lerp, damp, smoothstep,
  canvasTexture, glowTexture, textTexture, makeGlowSprite,
  mergeGeometries, transformed
} from './utils.js';

export const CITY = {
  block: 60,
  roadHalf: 7,
  blockHalf: 23,
  edge: 260,
  max: 240
};

const NEON = [0xff2f8e, 0x34e5ff, 0xffd166, 0xa77bff, 0x63ffb0, 0xff7043];

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.rng = mulberry32(20260707);
    this.solids = [];
    this.raycastMeshes = [];
    this.facadeMaterials = [];
    this.signMaterials = [];
    this.stripMesh = null;
    this.time = 0;
    this.night = 0;
    this.dusk = 1;
    this.sunDir = new THREE.Vector3(0.2, 0.4, 0.5);
    this.carSpots = [];
    this.beacons = [];
    this.tmpColor = new THREE.Color();
    this.tmpColor2 = new THREE.Color();
    this.builders = [];
    this.planPalms = [];
    this.shadowFocus = new THREE.Vector3();

    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildDistantCity();
    this.buildStreetFurniture();
    this.buildInstancedDetails();
    this.buildArch();
    this.buildBladeSigns();
    this.buildPlaza();
    this.applyTimeOfDay();
  }

  r(min = 0, max = 1) { return min + this.rng() * (max - min); }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length) % arr.length]; }

  addSolid(x, z, w, d) {
    this.solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  isSolid(x, z, radius = 0.4) {
    if (Math.abs(x) > 288 || Math.abs(z) > 288) return true;
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      if (x > s.minX - radius && x < s.maxX + radius && z > s.minZ - radius && z < s.maxZ + radius) return true;
    }
    return false;
  }

  groundHeight(x, z) {
    const cx = Math.round((x - 30) / 60) * 60 + 30;
    const cz = Math.round((z - 30) / 60) * 60 + 30;
    if (Math.abs(x - cx) <= 23 && Math.abs(z - cz) <= 23) return 0.3;
    return 0;
  }

  buildSky() {
    const uniforms = {
      topColor: { value: new THREE.Color(0x2c4f9e) },
      horizonColor: { value: new THREE.Color(0xff9a6a) },
      sunColor: { value: new THREE.Color(0xffd2a0) },
      sunDir: { value: this.sunDir.clone() },
      sunPower: { value: 1.0 }
    };
    this.skyUniforms = uniforms;
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform float sunPower;
        varying vec3 vWorld;
        void main() {
          vec3 dir = normalize(vWorld);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.62));
          float sd = max(dot(dir, normalize(sunDir)), 0.0);
          col += sunColor * pow(sd, 320.0) * 2.2 * sunPower;
          col += sunColor * pow(sd, 12.0) * 0.20 * sunPower;
          col += sunColor * pow(sd, 2.4) * 0.05 * sunPower;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 40, 22), mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    const starPositions = [];
    const starRng = mulberry32(99);
    for (let i = 0; i < 700; i++) {
      const a = starRng() * Math.PI * 2;
      const y = 0.05 + starRng() * 0.95;
      const r = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xcfe4ff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    this.clouds = [];
    const cloudTex = canvasTexture(256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const grd = ctx.createRadialGradient(w * 0.5, h * 0.55, 4, w * 0.5, h * 0.55, w * 0.48);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      grd.addColorStop(0.7, 'rgba(255,255,255,0.14)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.55, w * 0.46, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      const rng = mulberry32(7);
      for (let i = 0; i < 10; i++) {
        const cx = w * (0.22 + rng() * 0.56);
        const cy = h * (0.4 + rng() * 0.26);
        const rr = w * (0.06 + rng() * 0.12);
        const g2 = ctx.createRadialGradient(cx, cy, 1, cx, cy, rr);
        g2.addColorStop(0, 'rgba(255,255,255,0.5)');
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    for (let i = 0; i < 9; i++) {
      const matC = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, opacity: 0.45, depthWrite: false, fog: false,
        color: 0xffc2a1
      });
      const sp = new THREE.Sprite(matC);
      const ang = (i / 9) * Math.PI * 2 + this.r(-0.2, 0.2);
      const dist = 520 + this.r(-50, 90);
      sp.position.set(Math.cos(ang) * dist, this.r(90, 190), Math.sin(ang) * dist);
      sp.scale.set(this.r(190, 340), this.r(50, 100), 1);
      sp.userData.baseOpacity = this.r(0.18, 0.4);
      matC.opacity = sp.userData.baseOpacity;
      this.clouds.push(sp);
      this.scene.add(sp);
    }

    this.sunSprite = makeGlowSprite(0xffd6a8, 210, 0.55);
    this.sunSprite.position.copy(this.sunDir).multiplyScalar(820);
    this.scene.add(this.sunSprite);

    this.scene.fog = new THREE.FogExp2(0xff9a6a, 0.0017);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x342046, 1.2);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffc08a, 3.0);
    this.sun.position.set(120, 160, 220);
    this.sun.castShadow = true;
    const shadowSize = window.innerWidth < 900 ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 620;
    this.sun.shadow.camera.left = -125;
    this.sun.shadow.camera.right = 125;
    this.sun.shadow.camera.top = 125;
    this.sun.shadow.camera.bottom = -125;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x7088ff, 0);
    this.moon.position.set(-100, 120, -160);
    this.scene.add(this.moon);

    const plazaLightPositions = [[8, 4.5, 84], [52, 4.5, 84], [8, 4.5, 116], [52, 4.5, 100]];
    this.plazaLights = plazaLightPositions.map((p) => {
      const l = new THREE.PointLight(0xffb36b, 0, 24, 2);
      l.position.set(p[0], p[1], p[2]);
      this.scene.add(l);
      return l;
    });
  }

  buildGround() {
    const sand = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c9a77a';
      ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(12);
      for (let i = 0; i < 2400; i++) {
        const v = 120 + Math.floor(rng() * 60);
        ctx.fillStyle = `rgba(${v + 50},${v + 22},${v - 24},${0.18 + rng() * 0.25})`;
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
      }
    }, { repeat: [90, 90] });

    const asphalt = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1a1722';
      ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(33);
      for (let i = 0; i < 3600; i++) {
        const v = 20 + Math.floor(rng() * 34);
        ctx.fillStyle = `rgba(${v + 8},${v},${v + 20},${0.18 + rng() * 0.3})`;
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
      }
      ctx.strokeStyle = 'rgba(8,6,14,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        let x = rng() * w, y = rng() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += rng() * 26 - 13; y += rng() * 26 - 13; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      const glow = ctx.createLinearGradient(0, 0, w, h);
      glow.addColorStop(0, 'rgba(80,20,90,0.1)');
      glow.addColorStop(0.5, 'rgba(10,30,60,0.05)');
      glow.addColorStop(1, 'rgba(120,20,60,0.08)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }, { repeat: [70, 70] });

    const groundMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.84, metalness: 0.16, color: 0xb7b1c5, emissive: 0x0b0714, emissiveIntensity: 0.55 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const sandMat = new THREE.MeshStandardMaterial({ map: sand, roughness: 1, metalness: 0, color: 0xffffff });
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), sandMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = -0.32;
    beach.receiveShadow = false;
    this.scene.add(beach);

    this.oceanUniforms = {
      time: { value: 0 },
      deepColor: { value: new THREE.Color(0x061a3a) },
      shallowColor: { value: new THREE.Color(0x0f6f8f) },
      sunColor: { value: new THREE.Color(0xffb07a) },
      sunDir: { value: new THREE.Vector3(0, 0.3, 0.4) },
      fogColor: { value: new THREE.Color(0xff9a6a) },
      dayMix: { value: 1 }
    };
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      fog: false,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float time;
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform vec3 fogColor;
        uniform float dayMix;
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vec2 p = vUv * 70.0;
          float w1 = sin(p.x * 0.9 + time * 0.55) * 0.5 + 0.5;
          float w2 = sin(p.y * 1.7 - time * 0.42 + sin(p.x * 0.35) * 1.4) * 0.5 + 0.5;
          float w3 = sin((p.x + p.y) * 0.42 + time * 0.3) * 0.5 + 0.5;
          vec3 col = mix(deepColor, shallowColor, w1 * 0.34 + w2 * 0.28 + w3 * 0.16);
          col += vec3(0.05, 0.12, 0.18) * pow(w2, 6.0);
          float glint = pow(max(0.0, sin(p.x * 0.28 + time * 0.8) * 0.5 + 0.5), 22.0);
          glint *= pow(max(0.0, sin(p.y * 0.7 - time * 0.4) * 0.5 + 0.5), 8.0);
          col += sunColor * glint * 1.3 * max(0.0, sunDir.y + 0.25);
          float d = distance(cameraPosition, vWorld);
          col = mix(col, fogColor, smoothstep(150.0, 760.0, d));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2200), oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = -1.05;
    this.scene.add(this.ocean);
  }

  buildRoads() {
    const white = new THREE.MeshStandardMaterial({ color: 0xd9d8cf, roughness: 0.6, metalness: 0, emissive: 0x2a2a22, emissiveIntensity: 0.12 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xe2b34d, roughness: 0.7, emissive: 0x5a3a06, emissiveIntensity: 0.25 });
    const dashGeo = new THREE.BoxGeometry(1, 0.012, 1);
    const yellowMatrices = [];
    const whiteMatrices = [];
    const dummy = new THREE.Object3D();

    for (let i = -4; i <= 4; i++) {
      const c = i * 60;
      for (let t = -236; t <= 236; t += 8) {
        if (Math.abs(t % 60) < 11) continue;
        dummy.position.set(c, 0.028, t);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.18, 1, 2.7);
        dummy.updateMatrix();
        yellowMatrices.push(dummy.matrix.clone());
        for (const side of [-1, 1]) {
          dummy.position.set(c + side * 3.6, 0.026, t);
          dummy.scale.set(0.12, 1, 3.1);
          dummy.updateMatrix();
          whiteMatrices.push(dummy.matrix.clone());
        }
      }
      for (let t = -236; t <= 236; t += 8) {
        if (Math.abs(t % 60) < 11) continue;
        dummy.position.set(t, 0.028, c);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.scale.set(0.18, 1, 2.7);
        dummy.updateMatrix();
        yellowMatrices.push(dummy.matrix.clone());
        for (const side of [-1, 1]) {
          dummy.position.set(t, 0.026, c + side * 3.6);
          dummy.rotation.set(0, Math.PI / 2, 0);
          dummy.scale.set(0.12, 1, 3.1);
          dummy.updateMatrix();
          whiteMatrices.push(dummy.matrix.clone());
        }
      }
    }

    const addInstances = (matrices, material) => {
      const mesh = new THREE.InstancedMesh(dashGeo, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    addInstances(yellowMatrices, yellow);
    addInstances(whiteMatrices, white);

    const crossMatrices = [];
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        const cx = ix * 60;
        const cz = iz * 60;
        for (let s = -2; s <= 2; s++) {
          for (const side of [-1, 1]) {
            dummy.position.set(cx + s * 1.5, 0.03, cz + side * 9.5);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(0.72, 1, 2.2);
            dummy.updateMatrix();
            crossMatrices.push(dummy.matrix.clone());
            dummy.position.set(cx + side * 9.5, 0.03, cz + s * 1.5);
            dummy.rotation.set(0, Math.PI / 2, 0);
            dummy.scale.set(0.72, 1, 2.2);
            dummy.updateMatrix();
            crossMatrices.push(dummy.matrix.clone());
          }
        }
      }
    }
    const crossMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), white, crossMatrices.length);
    crossMatrices.forEach((m, i) => crossMesh.setMatrixAt(i, m));
    crossMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(crossMesh);

    this.roadMarkingMeshes = [crossMesh];
  }

  makeFacadeTexture(baseColor, seed) {
    const rng = mulberry32(seed);
    const lit = [];
    const drawWindows = (ctx, emissive) => {
      if (!emissive) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 128, 256);
        const grad = ctx.createLinearGradient(0, 0, 128, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0.10)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.16)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 256);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 256);
      }
      const cols = 4;
      const rows = 8;
      const mx = 11;
      const my = 12;
      const cw = (128 - mx * 2) / cols;
      const ch = (256 - my * 2) / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = mx + col * cw + 3;
          const y = my + row * ch + 4;
          const w = cw - 6;
          const h = ch - 8;
          const isLit = lit[row * cols + col];
          if (emissive) {
            if (!isLit) continue;
            const warm = rng() > 0.25;
            ctx.fillStyle = warm ? (rng() > 0.5 ? '#ffc78a' : '#ffd9ac') : '#9fe8ff';
            ctx.globalAlpha = 0.55 + rng() * 0.45;
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = 1;
          } else {
            const grad = ctx.createLinearGradient(x, y, x + w, y + h);
            if (isLit) {
              grad.addColorStop(0, '#fff0c0');
              grad.addColorStop(0.6, '#d9b877');
              grad.addColorStop(1, '#6f5c35');
            } else {
              grad.addColorStop(0, '#16233a');
              grad.addColorStop(0.55, '#0c1424');
              grad.addColorStop(1, '#1f3454');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(0,0,0,0.38)';
            ctx.lineWidth = 1.4;
            ctx.strokeRect(x, y, w, h);
            if (!isLit) {
              ctx.fillStyle = 'rgba(120,180,255,0.12)';
              ctx.fillRect(x + 2, y + 2, w * 0.32, h * 0.5);
            }
          }
        }
      }
      if (!emissive) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let row = 0; row < rows; row++) {
          const y = my + row * ch + ch - 3;
          ctx.fillRect(0, y, 128, 2);
        }
      }
    };
    for (let i = 0; i < 32; i++) lit.push(rng() < 0.44);
    const map = canvasTexture(128, 256, (ctx) => drawWindows(ctx, false));
    const emissive = canvasTexture(128, 256, (ctx) => drawWindows(ctx, true));
    return { map, emissive };
  }

  buildBlocks() {
    const palette = [
      '#d8b9a4', '#b7c9c9', '#d9a8a0', '#99a9c7',
      '#d8d2c0', '#b9a6c9', '#a9c9b3', '#e0c596'
    ];
    this.facadeTextures = palette.map((c, i) => this.makeFacadeTexture(c, 100 + i));
    for (const pair of this.facadeTextures) {
      const mat = new THREE.MeshStandardMaterial({
        map: pair.map,
        emissiveMap: pair.emissive,
        emissive: 0xffd8a4,
        emissiveIntensity: 0.22,
        roughness: 0.62,
        metalness: 0.16,
        color: 0xffffff
      });
      this.facadeMaterials.push(mat);
    }

    const sidewalkTex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#6b6776';
      ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(55);
      for (let i = 0; i < 2800; i++) {
        const v = 82 + Math.floor(rng() * 42);
        ctx.fillStyle = `rgba(${v},${v - 2},${v + 10},${0.14 + rng() * 0.22})`;
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
      }
      ctx.strokeStyle = 'rgba(38,34,46,0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
      }
    }, { repeat: [4, 4] });
    const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.9, metalness: 0.04, color: 0xd0c9db });

    const grassTex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1c432d';
      ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(77);
      for (let i = 0; i < 3800; i++) {
        const g = 45 + rng() * 55;
        ctx.fillStyle = `rgba(${Math.floor(g * 0.4)},${Math.floor(g + 30)},${Math.floor(g * 0.55)},${0.2 + rng() * 0.3})`;
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 3);
      }
    }, { repeat: [6, 6] });
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 });

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2338, roughness: 0.86, metalness: 0.22 });
    this.roofMat = roofMat;

    const topData = [];
    const antennaData = [];
    const beaconPositions = [];
    const stripData = [];
    const buildingData = [];
    const platformParts = [];
    const lawnParts = [];
    const buildingParts = this.facadeMaterials.map(() => []);
    const plazaBX = 30, plazaBZ = 90;

    for (let bx = -210; bx <= 210; bx += 60) {
      for (let bz = -210; bz <= 210; bz += 60) {
        platformParts.push(transformed(new THREE.BoxGeometry(46, 0.3, 46), [bx, 0.15, bz], [0, 0, 0], [1, 1, 1]));

        const isPlaza = bx === plazaBX && bz === plazaBZ;
        if (isPlaza) continue;

        const type = this.rng();
        if (type < 0.13) {
          lawnParts.push(transformed(new THREE.PlaneGeometry(40, 40), [bx, 0.315, bz], [-Math.PI / 2, 0, 0], [1, 1, 1]));
          this.planPalms.push({ x: bx + this.r(-15, 15), z: bz + this.r(-15, 15), scale: this.r(0.8, 1.25) });
          this.planPalms.push({ x: bx + this.r(-15, 15), z: bz + this.r(-15, 15), scale: this.r(0.8, 1.2) });
          continue;
        }

        const cells = [
          [-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]
        ];
        let count;
        if (this.rng() < 0.16) count = 1;
        else if (this.rng() < 0.58) count = 2;
        else count = 3;
        const shuffled = cells.slice().sort(() => this.rng() - 0.5).slice(0, count);
        const downtown = Math.hypot(bx - 0, bz + 40);
        const tall = clamp(1 - downtown / 340, 0, 1);

        for (const cell of shuffled) {
          const w = this.r(13.5, 20.5);
          const d = this.r(13.5, 20.5);
          if (count === 1 && this.rng() < 0.3) { /* keep wide tower */ }
          const h = clamp(
            this.r(12, 30) + tall * tall * this.r(28, 92) + (this.rng() < 0.12 ? this.r(10, 30) : 0),
            10, 122
          );
          const x = bx + cell[0] + this.r(-1.2, 1.2);
          const z = bz + cell[1] + this.r(-1.2, 1.2);
          const matIndex = Math.floor(this.rng() * this.facadeMaterials.length);
          const geo = new THREE.BoxGeometry(1, 1, 1);
          const cols = clamp(Math.round(w / 18), 1, 3);
          const rows = clamp(Math.round(h / 34), 1, 4);
          const uv = geo.attributes.uv;
          for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, uv.getX(i) * cols, uv.getY(i) * rows);
          }
          uv.needsUpdate = true;
          buildingParts[matIndex].push(transformed(geo, [x, 0.3 + h / 2, z], [0, 0, 0], [w, h, d]));
          geo.dispose();
          buildingData.push({ position: { x, y: 0.3 + h / 2, z }, scale: { x: w, y: h, z: d } });
          this.addSolid(x, z, w, d);

          topData.push({ x, z, y: 0.3 + h + 0.28, w: w + 0.6, d: d + 0.6 });
          if (h > 42) {
            const ax = x + this.r(-w * 0.25, w * 0.25);
            const az = z + this.r(-d * 0.25, d * 0.25);
            antennaData.push({ x: ax, z: az, y: 0.3 + h + 2.4, h: this.r(3, 10) });
            beaconPositions.push([ax, 0.3 + h + 2.4 + this.r(3, 10), az]);
          }
          if (this.rng() < 0.72) {
            const color = NEON[Math.floor(this.rng() * NEON.length)];
            const band = this.rng() < 0.5 ? 0 : 1;
            const by = band ? 1.35 : 3.1;
            if (this.rng() < 0.5) stripData.push({ x: x, y: 0.3 + by, z: z + d / 2 + 0.06, sx: w * 0.82, sy: 0.09, sz: 0.1, color });
            else stripData.push({ x: x, y: 0.3 + by, z: z - d / 2 - 0.06, sx: w * 0.82, sy: 0.09, sz: 0.1, color });
            if (this.rng() < 0.4) stripData.push({ x: x + w / 2 + 0.06, y: 0.3 + by, z: z, sx: 0.1, sy: 0.09, sz: d * 0.82, color });
          }
          if (this.rng() < 0.55) {
            const side = this.pick([0, 1, 2, 3]);
            const color = NEON[Math.floor(this.rng() * NEON.length)];
            if (side === 0) stripData.push({ x: x, y: 0.3 + h * this.r(0.35, 0.8), z: z + d / 2 + 0.06, sx: this.r(0.14, 0.3), sy: this.r(2.5, 7), sz: 0.12, color });
            else if (side === 1) stripData.push({ x: x + w / 2 + 0.06, y: 0.3 + h * this.r(0.35, 0.8), z: z, sx: 0.12, sy: this.r(2.5, 7), sz: this.r(0.14, 0.3), color });
            else if (side === 2) stripData.push({ x: x, y: 0.3 + h * this.r(0.35, 0.8), z: z - d / 2 - 0.06, sx: this.r(0.14, 0.3), sy: this.r(2.5, 7), sz: 0.12, color });
            else stripData.push({ x: x - w / 2 - 0.06, y: 0.3 + h * this.r(0.35, 0.8), z: z, sx: 0.12, sy: this.r(2.5, 7), sz: this.r(0.14, 0.3), color });
          }
        }
      }
    }

    const platformMesh = new THREE.Mesh(mergeGeometries(platformParts), sidewalkMat);
    platformMesh.receiveShadow = true;
    this.scene.add(platformMesh);
    for (const part of platformParts) part.dispose();

    const lawnMesh = new THREE.Mesh(mergeGeometries(lawnParts), grassMat);
    lawnMesh.receiveShadow = true;
    this.scene.add(lawnMesh);
    for (const part of lawnParts) part.dispose();

    buildingParts.forEach((parts, i) => {
      if (!parts.length) return;
      const mesh = new THREE.Mesh(mergeGeometries(parts), this.facadeMaterials[i]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.building = true;
      this.scene.add(mesh);
      this.raycastMeshes.push(mesh);
      for (const part of parts) part.dispose();
    });

    const roofGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, topData.length);
    const dummy = new THREE.Object3D();
    topData.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(t.w, 0.6, t.d);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(i, dummy.matrix);
    });
    roofMesh.instanceMatrix.needsUpdate = true;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    this.scene.add(roofMesh);

    const antennaGeo = new THREE.CylinderGeometry(0.12, 0.16, 1, 5);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x9a94a8, roughness: 0.5, metalness: 0.7 });
    if (antennaData.length) {
      const antMesh = new THREE.InstancedMesh(antennaGeo, antennaMat, antennaData.length);
      antennaData.forEach((a, i) => {
        dummy.position.set(a.x, a.y + a.h / 2, a.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, a.h, 1);
        dummy.updateMatrix();
        antMesh.setMatrixAt(i, dummy.matrix);
      });
      antMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(antMesh);
    }
    if (beaconPositions.length) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(beaconPositions.flat(), 3));
      this.beaconMat = new THREE.PointsMaterial({
        color: 0xff3344, size: 3.4, map: glowTexture(), transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      this.beacons = new THREE.Points(bg, this.beaconMat);
      this.scene.add(this.beacons);
    }

    if (stripData.length) {
      const stripGeo = new THREE.BoxGeometry(1, 1, 1);
      const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const stripMesh = new THREE.InstancedMesh(stripGeo, stripMat, stripData.length);
      const col = new THREE.Color();
      stripData.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s.sx, s.sy, s.sz);
        dummy.updateMatrix();
        stripMesh.setMatrixAt(i, dummy.matrix);
        stripMesh.setColorAt(i, col.setHex(s.color));
      });
      stripMesh.instanceMatrix.needsUpdate = true;
      stripMesh.instanceColor.needsUpdate = true;
      this.stripMesh = stripMesh;
      this.scene.add(stripMesh);
    }

    this.buildNeonSigns(buildingData);
    this.buildBillboards(buildingData);
  }

  buildNeonSigns(buildings) {
    const words = ['HOTEL', 'NEON', 'CLUB', 'VICE', '24/7', 'ARCADE', 'PIZZA', 'MOTEL', 'LIQUOR', 'SUNSET', 'OCEAN', 'RADIO'];
    const colors = ['#ff5aa8', '#67f0ff', '#ffd166', '#b78bff', '#7dffb3'];
    const chosen = buildings
      .filter((b) => b.position.y > 8 && this.rng() < 0.24)
      .slice(0, 14);
    for (const b of chosen) {
      const side = Math.floor(this.rng() * 4);
      const w = b.scale.x;
      const d = b.scale.z;
      const word = this.pick(words);
      const color = this.pick(colors);
      const tex = textTexture(word, { size: 128, color, glowColor: color, pad: 10, glowBlur: 34 });
      const map = tex;
      const aspect = map.image.width / map.image.height;
      const hgt = this.r(2.2, 3.2);
      const wid = hgt * aspect;
      const mat = new THREE.MeshBasicMaterial({
        map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), mat);
      const y = 0.3 + this.r(3.5, Math.max(5, b.scale.y * 0.7));
      if (side === 0) {
        plane.position.set(b.position.x, y, b.position.z + d / 2 + 0.12);
        plane.rotation.y = 0;
      } else if (side === 1) {
        plane.position.set(b.position.x + w / 2 + 0.12, y, b.position.z);
        plane.rotation.y = Math.PI / 2;
      } else if (side === 2) {
        plane.position.set(b.position.x, y, b.position.z - d / 2 - 0.12);
        plane.rotation.y = Math.PI;
      } else {
        plane.position.set(b.position.x - w / 2 - 0.12, y, b.position.z);
        plane.rotation.y = -Math.PI / 2;
      }
      const backing = new THREE.Mesh(
        new THREE.BoxGeometry(wid + 0.5, hgt + 0.4, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x120b1c, roughness: 0.7, metalness: 0.4 })
      );
      backing.position.copy(plane.position);
      backing.rotation.copy(plane.rotation);
      backing.translateZ(-0.1);
      this.scene.add(backing);
      this.scene.add(plane);
      this.signMaterials.push(mat);
      const halo = makeGlowSprite(color, hgt * 3.6, 0.16);
      halo.position.copy(plane.position);
      this.scene.add(halo);
    }
  }

  buildBillboards(buildings) {
    const ads = [
      { text: 'SUNSET 96.7', color: '#ffd166', bg: '#2a0c2e' },
      { text: 'VICE BEACH', color: '#67f0ff', bg: '#081a2e' },
      { text: 'NEON CITY', color: '#ff5aa8', bg: '#1a0626' },
      { text: 'OCEAN DRIVE', color: '#9dffc4', bg: '#0a201a' }
    ];
    const tall = buildings.filter((b) => b.scale.y > 38).sort((a, b) => b.scale.y - a.scale.y).slice(0, 7);
    tall.forEach((b, i) => {
      if (i >= ads.length) return;
      const ad = ads[i];
      const tex = textTexture(ad.text, { size: 128, color: ad.color, glowColor: ad.color, pad: 26, glowBlur: 30 });
      const aspect = tex.image.width / tex.image.height;
      const h = 5.5;
      const w = clamp(h * aspect, 8, 22);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.8, h + 0.8, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x140d22, roughness: 0.65, metalness: 0.5 })
      );
      const y = b.position.y + b.scale.y / 2 + 5.2;
      plane.position.set(b.position.x, y, b.position.z);
      plane.rotation.y = this.rng() < 0.5 ? 0 : Math.PI;
      frame.position.copy(plane.position);
      frame.rotation.copy(plane.rotation);
      frame.translateZ(-0.22);
      this.scene.add(frame);
      this.scene.add(plane);
      const glow = makeGlowSprite(ad.color, 22, 0.1);
      glow.position.copy(plane.position);
      this.scene.add(glow);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2438, roughness: 0.7, metalness: 0.5 });
      for (const off of [-w * 0.32, w * 0.32]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 0.3), legMat);
        leg.position.set(b.position.x + off, b.position.y + b.scale.y / 2 + 2.6, b.position.z);
        this.scene.add(leg);
      }
    });
  }

  buildStreetFurniture() {
    this.planPalms = this.planPalms || [];
    const dummy = new THREE.Object3D();
    const poleParts = [];
    const poleGeo = new THREE.CylinderGeometry(0.11, 0.18, 7, 6);
    poleParts.push(transformed(poleGeo, [0, 3.5, 0], [0, 0, 0], [1, 1, 1]));
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.42, 0.5, 8);
    poleParts.push(transformed(baseGeo, [0, 0.25, 0], [0, 0, 0], [1, 1, 1]));
    const armGeo = new THREE.BoxGeometry(0.13, 0.13, 1.55);
    poleParts.push(transformed(armGeo, [0, 6.75, 0.7], [0, 0, 0], [1, 1, 1]));
    this.lampPoleGeo = mergeGeometries(poleParts);
    const lampGeo = new THREE.BoxGeometry(0.48, 0.16, 0.34);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e2b38, roughness: 0.55, metalness: 0.7 });

    const transforms = [];
    const lampPositions = [];
    for (let i = -4; i <= 4; i++) {
      const c = i * 60;
      for (let t = -228; t <= 228; t += 38) {
        const side = Math.round(t / 38) % 2 === 0 ? -1 : 1;
        const x = c + side * 8.6;
        const z = t;
        const rot = -side * Math.PI / 2;
        transforms.push({ x, z, rot });
        lampPositions.push([x - side * 1.45, 6.75, z]);
        const x2 = t, z2 = c + side * 8.6;
        const rot2 = side > 0 ? Math.PI : 0;
        transforms.push({ x: x2, z: z2, rot: rot2 });
        lampPositions.push([x2, 6.75, z2 + side * 1.45]);
      }
    }
    const poles = new THREE.InstancedMesh(this.lampPoleGeo, poleMat, transforms.length);
    transforms.forEach((tr, i) => {
      dummy.position.set(tr.x, 0.3, tr.z);
      dummy.rotation.set(0, tr.rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    poles.castShadow = true;
    this.scene.add(poles);

    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x3a3026, emissive: 0xffb16a, emissiveIntensity: 2.4, roughness: 0.35, metalness: 0.2
    });
    this.lampMats = [lampMat];
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampPositions.length);
    lampPositions.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);
    });
    lamps.instanceMatrix.needsUpdate = true;
    this.scene.add(lamps);

    const glowPositions = [];
    for (const p of lampPositions) glowPositions.push(p[0], p[1] - 0.15, p[2]);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
    this.lampGlowMat = new THREE.PointsMaterial({
      color: 0xffbf7a, size: 4.4, map: glowTexture(), transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const glow = new THREE.Points(glowGeo, this.lampGlowMat);
    this.scene.add(glow);

    const poolGeo = new THREE.PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({
      map: glowTexture(), color: 0xffb877, transparent: true, opacity: 0.24,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    const pools = new THREE.InstancedMesh(poolGeo, this.poolMat, lampPositions.length);
    lampPositions.forEach((p, i) => {
      dummy.position.set(p[0], 0.055, p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(10.5, 1, 10.5);
      dummy.updateMatrix();
      pools.setMatrixAt(i, dummy.matrix);
    });
    pools.instanceMatrix.needsUpdate = true;
    pools.renderOrder = 2;
    this.scene.add(pools);

    for (let bx = -210; bx <= 210; bx += 60) {
      for (let bz = -210; bz <= 210; bz += 60) {
        const n = this.rng() < 0.8 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const corner = Math.floor(this.rng() * 4);
          const sx = corner === 1 || corner === 2 ? 21 : -21;
          const sz = corner >= 2 ? 21 : -21;
          this.planPalms.push({ x: bx + sx + this.r(-2, 2), z: bz + sz + this.r(-2, 2), scale: this.r(0.75, 1.2) });
        }
      }
    }

    const palmCount = this.planPalms.length;
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 5.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a34, roughness: 1 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
    this.planPalms.forEach((p, i) => {
      const lean = this.r(-0.22, 0.22);
      dummy.position.set(p.x, 0.3 + 2.8 * p.scale, p.z);
      dummy.rotation.set(lean, this.r(0, 6.28), lean * 0.6);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = true;
    this.scene.add(trunkMesh);

    const frondGeo = this.makeFrondGeometry();
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x1f7a4c, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, emissive: 0x062414, emissiveIntensity: 0.5 });
    const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmCount);
    this.planPalms.forEach((p, i) => {
      dummy.position.set(p.x, 0.3 + 5.5 * p.scale, p.z);
      dummy.rotation.set(this.r(-0.1, 0.1), this.r(0, 6.28), this.r(-0.1, 0.1));
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      fronds.setMatrixAt(i, dummy.matrix);
    });
    fronds.instanceMatrix.needsUpdate = true;
    fronds.castShadow = true;
    this.scene.add(fronds);

    this.spawnParkedCars();
  }

  makeFrondGeometry() {
    const positions = [];
    const normals = [];
    const uvs = [];
    const leaves = 8;
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * Math.PI * 2 + 0.22;
      const len = 2.2 + (i % 3) * 0.24;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const px = -dz;
      const pz = dx;
      const base = [0, 0, 0];
      const mid = [dx * len * 0.55, 0.45, dz * len * 0.55];
      const tip = [dx * len, -0.35, dz * len];
      const w = 0.48;
      const l1 = [mid[0] + px * w, mid[1] + 0.1, mid[2] + pz * w];
      const r1 = [mid[0] - px * w, mid[1] + 0.1, mid[2] - pz * w];
      positions.push(...base, ...l1, ...r1);
      positions.push(...l1, ...tip, ...r1);
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      uvs.push(0, 0, 1, 0.5, 0, 0.5);
      uvs.push(1, 0.5, 0.5, 1, 0, 0.5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  spawnParkedCars() {
    this.carSpots.push({ x: 3.7, z: 85.4, heading: Math.PI - 0.05, color: 0xff2f8e, sports: true, hero: true });
    const colors = [0xe9e4da, 0x3b6ea8, 0xd8503c, 0x2c2a33, 0x6a5acd, 0xe0b04a, 0x36b6a8, 0xcf6c9c];
    const rng = this.rng;
    for (let i = 0; i < 14; i++) {
      const onX = rng() < 0.5;
      const c = (Math.floor(rng() * 7) - 3) * 60;
      const t = (Math.floor(rng() * 11) - 5) * 36;
      const side = rng() < 0.5 ? -1 : 1;
      const heading = onX ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      let x, z;
      if (onX) { x = c + side * 5.2; z = t; }
      else { x = t; z = c + side * 5.2; }
      if (Math.hypot(x - 3.7, z - 85.4) < 30) continue;
      this.carSpots.push({ x, z, heading, color: colors[i % colors.length], sports: rng() < 0.35 });
    }
  }

  buildInstancedDetails() {
    // Benches and planters add texture to the sidewalks without many draw calls.
    const dummy = new THREE.Object3D();
    const benchParts = [];
    benchParts.push(transformed(new THREE.BoxGeometry(2.2, 0.16, 0.6), [0, 0.55, 0], [0, 0, 0], [1, 1, 1]));
    const legGeo = new THREE.BoxGeometry(0.12, 0.55, 0.5);
    benchParts.push(transformed(legGeo, [-0.85, 0.28, 0], [0, 0, 0], [1, 1, 1]));
    benchParts.push(transformed(legGeo, [0.85, 0.28, 0], [0, 0, 0], [1, 1, 1]));
    benchParts.push(transformed(new THREE.BoxGeometry(2.2, 0.5, 0.12), [0, 0.85, -0.24], [0, 0, 0], [1, 1, 1]));
    const benchGeo = mergeGeometries(benchParts);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x4b3b2f, roughness: 0.9 });
    const benchSpots = [];
    for (let bx = -210; bx <= 210; bx += 60) {
      for (let bz = -210; bz <= 210; bz += 60) {
        if (this.rng() < 0.55) {
          benchSpots.push({ x: bx + this.r(-18, 18), z: bz + 21.5, rot: 0 });
        }
        if (this.rng() < 0.4) {
          benchSpots.push({ x: bx + 21.5, z: bz + this.r(-18, 18), rot: Math.PI / 2 });
        }
      }
    }
    const benches = new THREE.InstancedMesh(benchGeo, benchMat, benchSpots.length);
    benchSpots.forEach((b, i) => {
      dummy.position.set(b.x, 0.3, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      benches.setMatrixAt(i, dummy.matrix);
    });
    benches.instanceMatrix.needsUpdate = true;
    benches.castShadow = true;
    this.scene.add(benches);
  }

  buildArch() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a1d3a, roughness: 0.5, metalness: 0.7 });
    for (const x of [-8.6, 8.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.7), metal);
      post.position.set(x, 4.5, 0);
      post.castShadow = true;
      group.add(post);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x34e5ff, toneMapped: false });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 8.2, 0.12), glowMat);
      strip.position.set(x - 0.42, 4.6, 0.34);
      group.add(strip);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 0.7), metal);
    bar.position.set(0, 8.7, 0);
    group.add(bar);
    const tex = textTexture('OCEAN DRIVE', { size: 150, color: '#ffe6ff', glowColor: '#ff2f8e', pad: 22, glowBlur: 36 });
    const aspect = tex.image.width / tex.image.height;
    const signW = 16;
    const signH = signW / aspect;
    const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), signMat);
    sign.position.set(0, 7.1, 0.42);
    group.add(sign);
    const halo = makeGlowSprite(0xff2f8e, 22, 0.22);
    halo.position.set(0, 7.3, 0.2);
    group.add(halo);
    group.position.set(0, 0, 60);
    this.scene.add(group);
    this.archSignMat = signMat;
    this.signMaterials.push(signMat);
  }

  buildBladeSigns() {
    const words = [
      { text: 'CLUB', color: '#ff5aa8' },
      { text: 'HOTEL', color: '#67f0ff' },
      { text: '24/7', color: '#ffd166' },
      { text: 'ARCADE', color: '#b78bff' },
      { text: 'PIZZA', color: '#ffa15a' },
      { text: 'LIQUOR', color: '#7dffb3' },
      { text: 'RADIO', color: '#ff5aa8' },
      { text: 'MOTEL', color: '#67f0ff' }
    ];
    const placements = [
      { x: 8.9, z: 106, side: 1 }, { x: -8.9, z: 96, side: -1 },
      { x: 8.9, z: 72, side: 1 }, { x: -8.9, z: 62, side: -1 },
      { x: 8.9, z: 38, side: 1 }, { x: -8.9, z: 28, side: -1 },
      { x: 8.9, z: 14, side: 1 }, { x: -8.9, z: 4, side: -1 }
    ];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2238, roughness: 0.5, metalness: 0.75 });
    const frameParts = [];
    placements.forEach((pl, i) => {
      const w = words[i % words.length];
      const tex = textTexture(w.text, { size: 128, color: w.color, glowColor: w.color, pad: 12, glowBlur: 30 });
      const aspect = tex.image.width / tex.image.height;
      const h = 2.0;
      const wid = h * aspect;
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        toneMapped: false, side: THREE.DoubleSide
      });
      const y = 5.3 + (i % 3) * 0.4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(wid, h), mat);
      sign.position.set(pl.x, y, pl.z);
      sign.rotation.y = 0;
      this.scene.add(sign);
      this.signMaterials.push(mat);
      const bar = 0.09;
      const rail = 0.12;
      const zf = pl.z - 0.07;
      frameParts.push(transformed(new THREE.BoxGeometry(wid + 0.45, bar, rail), [pl.x, y + h / 2 + 0.12, zf], [0, 0, 0], [1, 1, 1]));
      frameParts.push(transformed(new THREE.BoxGeometry(wid + 0.45, bar, rail), [pl.x, y - h / 2 - 0.12, zf], [0, 0, 0], [1, 1, 1]));
      frameParts.push(transformed(new THREE.BoxGeometry(bar, h + 0.33, rail), [pl.x - wid / 2 - 0.18, y, zf], [0, 0, 0], [1, 1, 1]));
      frameParts.push(transformed(new THREE.BoxGeometry(bar, h + 0.33, rail), [pl.x + wid / 2 + 0.18, y, zf], [0, 0, 0], [1, 1, 1]));
      const poleX = pl.x + (pl.side > 0 ? wid / 2 + 0.3 : -wid / 2 - 0.3);
      frameParts.push(transformed(new THREE.BoxGeometry(0.12, 4.6, 0.14), [poleX, 2.6, pl.z], [0, 0, 0], [1, 1, 1]));
      frameParts.push(transformed(new THREE.BoxGeometry(0.55, 0.1, 0.12), [poleX + (pl.side > 0 ? -0.28 : 0.28), 4.85, pl.z], [0, 0, 0], [1, 1, 1]));
      frameParts.push(transformed(new THREE.BoxGeometry(0.55, 0.1, 0.12), [poleX + (pl.side > 0 ? -0.28 : 0.28), 5.9, pl.z], [0, 0, 0], [1, 1, 1]));
      const halo = makeGlowSprite(w.color, h * 3.3, 0.16);
      halo.position.set(pl.x, y, pl.z);
      this.scene.add(halo);
    });
    const frameMesh = new THREE.Mesh(mergeGeometries(frameParts), poleMat);
    frameMesh.castShadow = true;
    this.scene.add(frameMesh);
    for (const part of frameParts) part.dispose();
  }

  buildPlaza() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x514a60, roughness: 0.8, metalness: 0.1 });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.8, 24), stoneMat);
    rim.position.set(30, 0.7, 90);
    rim.castShadow = true;
    rim.receiveShadow = true;
    group.add(rim);
    this.addSolid(30, 90, 10, 10);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0f5570, emissive: 0x0a2938, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.5 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.12, 24), waterMat);
    water.position.set(30, 1.15, 90);
    group.add(water);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 8), stoneMat);
    pillar.position.set(30, 1.8, 90);
    group.add(pillar);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), new THREE.MeshBasicMaterial({ color: 0x34e5ff, toneMapped: false }));
    orb.position.set(30, 3.2, 90);
    group.add(orb);
    const orbGlow = makeGlowSprite(0x34e5ff, 7, 0.35);
    orbGlow.position.copy(orb.position);
    group.add(orbGlow);
    this.plazaOrb = orb;
    this.plazaOrbGlow = orbGlow;
    this.scene.add(group);
    this.plaza = group;
  }

  buildDistantCity() {
    const rng = mulberry32(881);
    const count = 150;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x241b3d, roughness: 0.9, metalness: 0.1, emissive: 0x3a2a66, emissiveIntensity: 0.35
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.2;
      const r = 360 + rng() * 300;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = 18 + rng() * 115 * (0.4 + 0.6 * Math.abs(Math.sin(a * 2)));
      dummy.position.set(x, h / 2 - 1, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(16 + rng() * 32, h, 16 + rng() * 32);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.distantMat = mat;
    this.distantMesh = mesh;
    this.scene.add(mesh);

    this.planPalms = this.planPalms || [];
    for (let i = 0; i < 36; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      this.planPalms.push({ x: (rng() * 2 - 1) * 300, z: side * (290 + rng() * 35), scale: 0.7 + rng() * 0.6 });
    }
  }

  applyTimeOfDay() {
    const phase = (0.443 + this.time / 640) % 1;
    const ang = phase * Math.PI * 2;
    const elevation = Math.sin(ang);
    this.sunDir.set(Math.cos(ang), elevation, 0.32).normalize();
    const day = smoothstep(0.10, 0.46, elevation);
    const dusk = smoothstep(-0.16, 0.03, elevation) * (1 - day);
    const night = clamp(1 - day - dusk, 0, 1);
    this.night = night;
    this.dusk = dusk;
    this.day = day;

    const top = new THREE.Color(0x0b0c2c).lerp(new THREE.Color(0x3f7fd8), day).lerp(new THREE.Color(0x59358f), dusk * 0.9);
    const horizon = new THREE.Color(0x2c1c4d).lerp(new THREE.Color(0xffd0a0), day * 0.9).lerp(new THREE.Color(0xff8a64), dusk * 1.0);
    const sunCol = new THREE.Color(0xff7a45).lerp(new THREE.Color(0xfff2cf), Math.max(day, 0.35));
    const fogCol = horizon.clone().multiplyScalar(day * 0.2 + dusk * 0.5 + night * 0.3 + 0.22);

    this.skyUniforms.topColor.value.copy(top);
    this.skyUniforms.horizonColor.value.copy(horizon);
    this.skyUniforms.sunColor.value.copy(sunCol);
    this.skyUniforms.sunDir.value.copy(this.sunDir);
    this.skyUniforms.sunPower.value = 0.3 + day * 0.9 + dusk * 1.1;
    this.scene.fog.color.copy(fogCol);
    this.scene.fog.density = 0.00135 + night * 0.0008;
    this.oceanUniforms.fogColor.value.copy(fogCol);
    this.oceanUniforms.sunColor.value.copy(sunCol);
    this.oceanUniforms.sunDir.value.copy(this.sunDir);
    this.oceanUniforms.dayMix.value = day;

    this.hemi.color.copy(new THREE.Color(0x9fc0ff).lerp(new THREE.Color(0xffb38a), dusk * 0.7));
    this.hemi.groundColor.copy(new THREE.Color(0x241a33));
    this.hemi.intensity = 0.52 + day * 1.15 + dusk * 0.4;
    this.sun.color.copy(sunCol);
    this.sun.intensity = Math.max(0, smoothstep(-0.06, 0.24, elevation)) * (2.1 + day * 1.9);
    this.moon.intensity = night * 0.48;
    this.starMat.opacity = night * 0.85;
    this.sunSprite.material.opacity = (0.25 + day * 0.5 + dusk * 0.45) * clamp(elevation + 0.1, 0, 1);
    this.sunSprite.position.copy(this.sunDir).multiplyScalar(820);
    this.sunSprite.scale.setScalar(190 + dusk * 90);
    this.sunSprite.material.color.copy(sunCol);

    const facadeGlow = 0.12 + night * 2.3 + dusk * 0.3;
    for (const m of this.facadeMaterials) m.emissiveIntensity = facadeGlow;
    if (this.lampMats) for (const m of this.lampMats) m.emissiveIntensity = 0.25 + night * 3.2 + dusk * 0.8;
    if (this.lampGlowMat) this.lampGlowMat.opacity = 0.12 + night * 0.7 + dusk * 0.24;
    if (this.signMaterials) for (const m of this.signMaterials) m.opacity = 0.55 + night * 0.45 + dusk * 0.15;
    if (this.stripMesh) this.stripMesh.material.opacity = 1;
    this.plazaLights.forEach((l) => { l.intensity = (0.4 + night * 2.4 + dusk * 1.1) * 26; });
    if (this.poolMat) this.poolMat.opacity = 0.1 + night * 0.34 + dusk * 0.18;
    for (const c of this.clouds) c.material.color.copy(horizon).lerp(new THREE.Color(0xffffff), 0.35 + day * 0.3);
    const beaconsOn = night > 0.25 || dusk > 0.2;
    if (this.beaconMat) {
      this.beaconMat.opacity = beaconsOn ? 0.55 + 0.4 * Math.abs(Math.sin(this.time * 2)) : 0;
    }
    if (this.distantMat) this.distantMat.emissiveIntensity = 0.12 + night * 0.65;
  }

  setShadowFocus(x, z) {
    this.shadowFocus.set(x, 0, z);
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 240, this.sunDir.y * 240 + 6, z + this.sunDir.z * 240);
    this.sun.target.updateMatrixWorld();
  }

  update(dt, focus) {
    this.time += dt;
    this.applyTimeOfDay();
    this.oceanUniforms.time.value = this.time;
    if (focus) this.setShadowFocus(focus.x, focus.z);
    if (this.beaconMat) this.beaconMat.opacity = (this.night > 0.22 || this.dusk > 0.2) ? 0.45 + 0.45 * Math.abs(Math.sin(this.time * 2.4)) : 0;
    if (this.plazaOrb) {
      this.plazaOrb.rotation.y += dt * 1.4;
      this.plazaOrb.position.y = 3.2 + Math.sin(this.time * 1.6) * 0.16;
      this.plazaOrbGlow.position.copy(this.plazaOrb.position);
      this.plazaOrbGlow.material.opacity = 0.28 + Math.sin(this.time * 2) * 0.1;
    }
  }
}
