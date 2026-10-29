import * as THREE from 'three';
import { QUALITY, WELL, TAU, worldRandom } from './config.js';
import { material } from './materials.js';
import { scene } from './engine.js';
import { addBoxCollider, addCircleCollider, terrainHeight } from './world.js';

export const houseMeshes = [];
export const campFires = [];

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = QUALITY === 'high' && cast;
  mesh.receiveShadow = QUALITY === 'high' && receive;
  return mesh;
}

function makeGableRoof(width, depth, height, roofMaterial) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return shadowed(new THREE.Mesh(geometry, roofMaterial));
}

function addWindow(group, x, y, z, facing, lit) {
  const frame = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.18, 0.09), material.woodDark),
    false,
    false,
  );
  frame.position.set(x, y, z + facing * 0.045);
  group.add(frame);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.84, 1),
    lit ? material.windowLit : material.window,
  );
  glass.position.set(x, y, z + facing * 0.1);
  if (facing < 0) glass.rotation.y = Math.PI;
  group.add(glass);

  for (const offset of [-0.27, 0.27]) {
    const bar = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.02, 0.06), material.woodDark),
      false,
      false,
    );
    bar.position.set(x + offset, y, z + facing * 0.11);
    group.add(bar);
  }
}

function createHouse(config) {
  const {
    x, z, width = 8, depth = 7, height = 3.1, roofHeight = 2.15,
    wall = material.plaster, roof = material.roofRust, facing = 1,
    barn = false, lit = false, industrial = false,
  } = config;
  const group = new THREE.Group();
  const ground = terrainHeight(x, z);
  group.position.set(x, ground, z);

  const foundation = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(width + 0.34, 0.5, depth + 0.34), material.concrete),
  );
  foundation.position.y = 0.25;
  group.add(foundation);

  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wall));
  body.position.y = height / 2 + 0.48;
  group.add(body);
  houseMeshes.push(body);

  const trimTop = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.16, depth + 0.14), material.woodDark),
    false,
    true,
  );
  trimTop.position.y = height + 0.48;
  group.add(trimTop);

  const roofMesh = makeGableRoof(width + 0.9, depth + 0.85, roofHeight, roof);
  roofMesh.position.y = height + 0.55;
  group.add(roofMesh);
  houseMeshes.push(roofMesh);

  const frontZ = facing * (depth / 2 + 0.06);
  const door = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(barn ? 2.3 : 1.02, barn ? 2.5 : 2.08, 0.12), material.door),
    false,
    false,
  );
  door.position.set(barn ? 0 : -width * 0.12, (barn ? 1.25 : 1.04) + 0.42, frontZ);
  group.add(door);

  if (barn) {
    for (const angle of [-0.65, 0.65]) {
      const brace = shadowed(
        new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.1, 0.08), material.woodDark),
        false,
        false,
      );
      brace.position.set(0, 1.55, frontZ + facing * 0.1);
      brace.rotation.z = angle;
      group.add(brace);
    }
  }

  const windowXs = industrial ? [-width * 0.32, width * 0.32] : [-width * 0.3, width * 0.3];
  if (!barn) {
    for (const wx of windowXs) {
      addWindow(group, wx, height * 0.58 + 0.54, frontZ, facing, lit && worldRandom() > 0.45);
    }
    if (width > 7.5) {
      const sideX = width / 2 + 0.06;
      for (const side of [-1, 1]) {
        const sideWindow = shadowed(
          new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.02, 0.84), material.woodDark),
          false,
          false,
        );
        sideWindow.position.set(side * sideX, height * 0.58 + 0.54, 0);
        group.add(sideWindow);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.84), material.window);
        glass.rotation.y = side * Math.PI / 2;
        glass.position.set(side * (sideX + 0.05), height * 0.58 + 0.54, 0);
        group.add(glass);
      }
    }
  } else {
    addWindow(group, -width * 0.34, height * 0.62 + 0.5, frontZ, facing, false);
    addWindow(group, width * 0.34, height * 0.62 + 0.5, frontZ, facing, false);
  }

  if (industrial) {
    for (const offset of [-width * 0.28, width * 0.28]) {
      const shutter = shadowed(
        new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.9, 0.11), material.metal),
        false,
        false,
      );
      shutter.position.set(offset, 1.92, frontZ + facing * 0.02);
      group.add(shutter);
      for (let line = 0; line < 7; line += 1) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(3.62, 0.025, 0.02), material.woodDark);
        seam.position.set(offset, 0.74 + line * 0.4, frontZ + facing * 0.08);
        group.add(seam);
      }
    }
  }

  if (!barn && !industrial) {
    const chimney = shadowed(
      new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.7, 0.56), material.concrete),
    );
    chimney.position.set(width * 0.28, height + roofHeight * 0.48, -depth * 0.15);
    group.add(chimney);
  }

  const step = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.8), material.concrete),
    false,
    true,
  );
  step.position.set(barn ? 0 : -width * 0.12, 0.09, frontZ + facing * 0.32);
  group.add(step);

  scene.add(group);
  addBoxCollider(x, z, width + 0.2, depth + 0.2, 0.12);
  return group;
}

function createCar(x, z, rotation, color) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = rotation;
  const bodyMaterial = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.72, 1.58), bodyMaterial));
  body.position.y = 0.72;
  group.add(body);

  const cabin = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.72, 1.42), bodyMaterial));
  cabin.position.set(-0.25, 1.28, 0);
  group.add(cabin);
  const cabinDark = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.42, 1.46), material.window), false, false);
  cabinDark.position.set(-0.25, 1.38, 0);
  group.add(cabinDark);

  const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 8);
  const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x23241f, flatShading: true });
  for (const wx of [-1.15, 1.16]) {
    for (const wz of [-0.82, 0.82]) {
      const wheel = shadowed(new THREE.Mesh(wheelGeometry, wheelMaterial), true, false);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.38, wz);
      group.add(wheel);
    }
  }

  for (const lightX of [-1.58, 1.58]) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: lightX > 0 ? 0xb69a62 : 0x74372c }),
    );
    lamp.position.set(lightX, 0.76, 0);
    group.add(lamp);
  }

  const roofRack = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 1.2), material.metal), false, false);
  roofRack.position.set(-0.2, 1.66, 0);
  group.add(roofRack);

  scene.add(group);
  addBoxCollider(x, z, 3.7, 2.1, 0.05);
  return group;
}

function createWell() {
  const group = new THREE.Group();
  const ground = terrainHeight(WELL.x, WELL.z);
  group.position.set(WELL.x, ground, WELL.z);

  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.28, 1.02, 8), material.rock));
  base.position.y = 0.51;
  group.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.14, 4, 8), material.rock);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.04;
  group.add(rim);
  const dark = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 12),
    new THREE.MeshBasicMaterial({ color: 0x111813 }),
  );
  dark.rotation.x = -Math.PI / 2;
  dark.position.y = 1.02;
  group.add(dark);

  for (const x of [-1.08, 1.08]) {
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.35, 0.15), material.woodDark));
    post.position.set(x, 1.65, 0);
    group.add(post);
  }
  const roof = makeGableRoof(2.9, 1.75, 0.68, material.roofMoss);
  roof.position.y = 2.78;
  group.add(roof);
  const bar = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.95, 6), material.wood), false, false);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 2.34;
  group.add(bar);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.74, 4), material.woodDark);
  rope.position.y = 1.98;
  group.add(rope);
  const bucket = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.3, 7), material.metal), false, false);
  bucket.position.y = 1.55;
  group.add(bucket);

  scene.add(group);
  addCircleCollider(WELL.x, WELL.z, 1.02);
}

function createCrate(x, z, size = 0.72, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = rotation;
  const box = shadowed(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material.wood));
  box.position.y = size / 2;
  group.add(box);
  for (const side of [-1, 1]) {
    for (const axis of ['x', 'z']) {
      const brace = new THREE.Mesh(
        new THREE.BoxGeometry(axis === 'x' ? size * 0.88 : 0.055, 0.07, axis === 'z' ? size * 0.88 : 0.055),
        material.woodDark,
      );
      brace.position.set(axis === 'x' ? 0 : side * size * 0.51, size * 0.51, axis === 'z' ? 0 : side * size * 0.51);
      brace.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
      group.add(brace);
    }
  }
  scene.add(group);
  addBoxCollider(x, z, size, size, 0.04);
}

function createBarrel(x, z, color = 0x5b4c36) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  const barrelMaterial = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 1.02, 8), barrelMaterial));
  body.position.y = 0.51;
  group.add(body);
  for (const y of [0.23, 0.79]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.055, 8), material.metal);
    band.position.y = y;
    group.add(band);
  }
  scene.add(group);
  addCircleCollider(x, z, 0.4);
}

function createSandbagWall(x, z, rotation = 0, count = 4) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = rotation;
  for (let i = 0; i < count; i += 1) {
    for (let row = 0; row < 2; row += 1) {
      const bag = shadowed(
        new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 2, 4), material.sandbag),
        true,
        false,
      );
      bag.rotation.z = Math.PI / 2;
      bag.rotation.y = (row % 2) * 0.06;
      bag.scale.set(0.9, 1, 0.78);
      bag.position.set((i - (count - 1) / 2) * 0.5, 0.2 + row * 0.31, 0);
      group.add(bag);
    }
  }
  scene.add(group);
}

function createTent(x, z, rotation, frameMaterial = material.canvasGreen, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = rotation;
  group.scale.setScalar(scale);

  const shape = new THREE.Shape();
  shape.moveTo(-1.25, 0);
  shape.lineTo(1.25, 0);
  shape.lineTo(0, 1.55);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2.65, bevelEnabled: false });
  geometry.translate(0, 0, -1.325);
  const tent = shadowed(new THREE.Mesh(geometry, frameMaterial));
  group.add(tent);

  const openingShape = new THREE.Shape();
  openingShape.moveTo(-0.55, 0);
  openingShape.lineTo(0.55, 0);
  openingShape.lineTo(0, 0.95);
  openingShape.closePath();
  const opening = new THREE.Mesh(
    new THREE.ShapeGeometry(openingShape),
    new THREE.MeshBasicMaterial({ color: 0x10150f, side: THREE.DoubleSide }),
  );
  opening.position.set(0, 0.04, 1.336);
  group.add(opening);

  for (const side of [-1, 1]) {
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1.1, 3),
      new THREE.MeshBasicMaterial({ color: 0x8c8062 }),
    );
    rope.position.set(side * 0.52, 1.05, 1.9);
    rope.rotation.z = side * 0.44;
    group.add(rope);
  }

  scene.add(group);
  addBoxCollider(x, z, 2.1 * scale, 2.5 * scale, 0.06);
}

function createCampfire(x, z) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * TAU;
    const stone = shadowed(
      new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + worldRandom() * 0.08, 0), material.rock),
      true,
      false,
    );
    stone.position.set(Math.cos(angle) * 0.72, 0.1, Math.sin(angle) * 0.72);
    stone.scale.y = 0.7;
    group.add(stone);
  }
  for (const angle of [0.4, 1.7, 2.9]) {
    const log = shadowed(
      new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.15, 5), material.woodDark),
      false,
      false,
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = angle;
    log.position.y = 0.18;
    group.add(log);
  }
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7f32,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.05, 5), flameMaterial);
  flame.position.y = 0.72;
  group.add(flame);
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffdd7a, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  core.position.y = 0.55;
  group.add(core);

  const light = new THREE.PointLight(0xff7e35, QUALITY === 'low' ? 1.2 : 1.9, 11, 2);
  light.position.y = 1.2;
  group.add(light);
  scene.add(group);
  campFires.push({ group, flame, core, light, phase: worldRandom() * TAU });
  addCircleCollider(x, z, 0.52);
}

function createFences(lines) {
  const postTransforms = [];
  const railTransforms = [];
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  for (const [startX, startZ, endX, endZ] of lines) {
    const dx = endX - startX;
    const dz = endZ - startZ;
    const length = Math.hypot(dx, dz);
    const pieces = Math.max(1, Math.round(length / 2));
    const rotation = Math.atan2(-dz, dx);
    for (let i = 0; i <= pieces; i += 1) {
      const t = i / pieces;
      const x = startX + dx * t;
      const z = startZ + dz * t;
      position.set(x, terrainHeight(x, z) + 0.54, z);
      matrix.compose(position, quaternion.identity(), scale);
      postTransforms.push(matrix.clone());
    }
    for (let i = 0; i < pieces; i += 1) {
      const t0 = i / pieces;
      const t1 = (i + 1) / pieces;
      const midX = startX + dx * (t0 + t1) / 2;
      const midZ = startZ + dz * (t0 + t1) / 2;
      const yaw = new THREE.Quaternion().setFromAxisAngle(up, rotation);
      for (const height of [0.48, 0.84]) {
        position.set(midX, terrainHeight(midX, midZ) + height, midZ);
        matrix.compose(position, yaw, scale);
        railTransforms.push(matrix.clone());
      }
    }
  }

  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.06, 0.14), material.fence, postTransforms.length);
  postTransforms.forEach((transform, index) => postMesh.setMatrixAt(index, transform));
  postMesh.castShadow = QUALITY === 'high';
  scene.add(postMesh);

  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.02, 0.1, 0.055), material.fence, railTransforms.length);
  railTransforms.forEach((transform, index) => railMesh.setMatrixAt(index, transform));
  railMesh.castShadow = QUALITY === 'high';
  scene.add(railMesh);
}

function createPowerPoles() {
  const polePositions = [
    [5.4, 29],
    [5.4, 8],
    [5.4, -13],
    [5.4, -34],
  ];
  const tops = [];
  for (const [x, z] of polePositions) {
    const ground = terrainHeight(x, z);
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.4, 6), material.woodDark));
    pole.position.set(x, ground + 3.7, z);
    scene.add(pole);
    const cross = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.12), material.woodDark), false, false);
    cross.position.set(x, ground + 6.8, z);
    scene.add(cross);
    for (const offset of [-0.72, 0.72]) {
      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.18, 5), material.concrete);
      insulator.position.set(x + offset, ground + 6.96, z);
      scene.add(insulator);
    }
    tops.push(new THREE.Vector3(x, ground + 6.96, z));
    addCircleCollider(x, z, 0.18);
  }

  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x292a24, transparent: true, opacity: 0.7 });
  for (let i = 0; i < tops.length - 1; i += 1) {
    const a = tops[i];
    const b = tops[i + 1];
    for (const offset of [-0.72, 0.72]) {
      const points = [];
      for (let step = 0; step <= 10; step += 1) {
        const t = step / 10;
        const sag = Math.sin(t * Math.PI) * 0.65;
        points.push(new THREE.Vector3(
          a.x + offset + (b.x - a.x) * t,
          a.y + (b.y - a.y) * t - sag,
          a.z + (b.z - a.z) * t,
        ));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      scene.add(new THREE.Line(geometry, wireMaterial));
    }
  }
}

function cylinderBetween(start, end, radius, mat, segments = 5) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), mat));
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createRadioTower() {
  const x = -67;
  const z = -64;
  const ground = terrainHeight(x, z);
  const height = 22;
  const base = 2.9;
  const top = 0.45;
  const corners = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      corners.push(new THREE.Vector3(x + sx * base, ground, z + sz * base));
    }
  }
  const topCorners = corners.map((corner) => new THREE.Vector3(
    x + (corner.x - x) * (top / base),
    ground + height,
    z + (corner.z - z) * (top / base),
  ));
  for (let i = 0; i < 4; i += 1) {
    scene.add(cylinderBetween(corners[i], topCorners[i], 0.075, material.metal, 4));
  }
  for (let level = 1; level <= 6; level += 1) {
    const t = level / 7;
    const y = ground + height * t;
    const r = base * (1 - t) + top * t;
    const points = [
      new THREE.Vector3(x - r, y, z - r),
      new THREE.Vector3(x + r, y, z - r),
      new THREE.Vector3(x + r, y, z + r),
      new THREE.Vector3(x - r, y, z + r),
    ];
    for (let i = 0; i < 4; i += 1) {
      scene.add(cylinderBetween(points[i], points[(i + 1) % 4], 0.035, material.metal, 4));
    }
  }
  const antenna = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 5.5, 4), material.metal), false, false);
  antenna.position.set(x, ground + height + 2.2, z);
  scene.add(antenna);
  const beacon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 0),
    new THREE.MeshBasicMaterial({ color: 0xe74830 }),
  );
  beacon.position.set(x, ground + height + 5.05, z);
  scene.add(beacon);
  addCircleCollider(x, z, 2.4);
}

function createTownSign() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 232;
  const context = canvas.getContext('2d');
  context.fillStyle = '#5f5b45';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#c8ba93';
  context.lineWidth = 7;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.fillStyle = '#ded2af';
  context.textAlign = 'center';
  context.font = 'bold 76px Arial Narrow, Arial, sans-serif';
  context.fillText('KAMENKA', canvas.width / 2, 103);
  context.font = 'bold 25px Arial, sans-serif';
  context.fillStyle = '#d5b05c';
  context.fillText('CHERNOZEMSK REGION  ·  POP. 0', canvas.width / 2, 151);
  context.font = 'bold 20px Arial, sans-serif';
  context.fillStyle = '#a89f84';
  context.fillText('NO ENTRY  //  MILITARY QUARANTINE', canvas.width / 2, 192);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = QUALITY === 'high' ? 4 : 1;

  const group = new THREE.Group();
  const x = 5.9;
  const z = 20.5;
  group.position.set(x, terrainHeight(x, z), z);
  for (const offset of [-1.3, 1.3]) {
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.14), material.woodDark));
    post.position.set(offset, 1.05, 0);
    group.add(post);
  }
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.15, 1.15),
    new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  panel.position.set(0, 1.8, 0.02);
  group.add(panel);
  scene.add(group);
}

export function buildTown() {
  createHouse({ x: -12, z: 16, width: 8.2, depth: 7.2, height: 3.2, facing: 1, lit: true });
  createHouse({ x: 13, z: 12, width: 7.4, depth: 8.1, height: 3.05, facing: 1, roof: material.roofMoss });
  createHouse({ x: -14.5, z: -4, width: 9.1, depth: 7.1, height: 3.4, facing: 1, wall: material.plasterLight });
  createHouse({ x: 14, z: -6, width: 8.2, depth: 7.3, height: 3.05, facing: -1, lit: true });
  createHouse({
    x: -18, z: -24, width: 10.6, depth: 9.1, height: 4.3, roofHeight: 2.7,
    wall: material.barn, roof: material.roofDark, facing: 1, barn: true,
  });
  createHouse({ x: 17, z: -26, width: 9.1, depth: 8.2, height: 3.25, facing: 1, roof: material.roofMoss });
  createHouse({
    x: -25, z: -39, width: 16, depth: 10.5, height: 4.9, roofHeight: 1.2,
    wall: material.concrete, roof: material.roofDark, facing: 1, industrial: true,
  });
  createHouse({ x: 32, z: -18, width: 7.2, depth: 6.2, height: 2.9, facing: -1, wall: material.wood });

  createWell();
  createCar(-3.1, 6.2, 0.06, 0x6e4c3b);
  createCar(2.9, -31.5, -0.12, 0x4e5a54);
  createCar(-29.5, -13, 0.5, 0x735546);

  createFences([
    [-7.4, 30, -7.4, 22.5],
    [7.4, 30, 7.4, 22.5],
    [-24, 6.5, -18, 6.5],
    [27, -12, 34, -12],
    [-33, -33, -33, -22],
    [10.5, -35, 21.5, -35],
  ]);
  createPowerPoles();
  createRadioTower();
  createTownSign();

  const tentCampX = 34;
  const tentCampZ = 14;
  createTent(tentCampX, tentCampZ, -0.3, material.canvasGreen, 1);
  createTent(tentCampX + 3.4, tentCampZ + 2.2, 0.7, material.canvasTan, 0.92);
  createCampfire(tentCampX + 1.6, tentCampZ + 0.2);
  createSandbagWall(tentCampX - 1.7, tentCampZ - 2.2, 0.1, 5);
  createCrate(tentCampX + 2.7, tentCampZ - 1.9, 0.78, 0.2);

  createCampfire(5.2, 29.2);
  createSandbagWall(8.4, 28.2, -0.2, 4);
  createCrate(7.2, 30.2, 0.68, 0.3);
  createBarrel(-5.6, 27.6, 0x5b4c36);

  const props = [
    [-8.1, 20.7, 'crate'], [-8.4, 19.2, 'barrel'], [9.3, 17.7, 'crate'],
    [-9.1, -1.2, 'barrel'], [9.3, -2.6, 'crate'], [21.2, -8.3, 'barrel'],
    [-12.7, -18.9, 'crate'], [-24.8, -30.2, 'crate'], [-8.4, -42.3, 'barrel'],
    [12.5, -31.5, 'crate'], [28.8, -22.1, 'barrel'], [-30.8, -19.4, 'crate'],
  ];
  for (const [x, z, type] of props) {
    if (type === 'crate') createCrate(x, z, 0.7, worldRandom() * TAU);
    else createBarrel(x, z, worldRandom() > 0.5 ? 0x5b4c36 : 0x454c45);
  }

  createSandbagWall(-28.5, -47, 0.2, 6);
  createTent(-33, 34, 0.8, material.canvasTan, 0.95);
  createCampfire(-30.2, 30.9);

  createCrate(23.8, -40.2, 0.84, 0.2);
  createCrate(22.9, -41.4, 0.68, -0.4);
  createBarrel(29.4, -39.4, 0x474d45);
}
