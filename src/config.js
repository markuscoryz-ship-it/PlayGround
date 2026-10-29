export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const dampAngle = (a, b, rate, dt) => {
  const delta = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + delta * (1 - Math.exp(-rate * dt));
};
export const formatClock = (seconds) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};
export const seededRandom = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const worldRandom = seededRandom(0x51f15e);
export const detailRandom = seededRandom(0xdecafbad);

export const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
export let touchUi = coarsePointer || window.innerWidth < 820;
export const QUALITY = touchUi ? 'low' : 'high';

export function refreshTouchUi() {
  touchUi = coarsePointer || window.innerWidth < 820;
  document.body.classList.toggle('touch-ui', touchUi);
  return touchUi;
}
document.body.classList.toggle('touch-ui', touchUi);

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'M1911',
    damage: 42,
    magSize: 8,
    fireDelay: 0.29,
    reloadTime: 1.18,
    range: 65,
  },
  rifle: {
    id: 'rifle',
    name: 'MOSIN',
    damage: 105,
    magSize: 5,
    fireDelay: 0.82,
    reloadTime: 1.85,
    range: 95,
  },
};

export const TOWN = { x: 0, z: -8, radius: 34 };
export const POND = { x: 55, z: 10, radius: 17 };
export const WATER_LEVEL = -1.15;
export const DAY_SECONDS = 480;
export const START_HOUR = 17.5;
export const DAWN_HOUR = 30;
export const WELL = { x: 3.4, z: -1, radius: 1.25 };

export const LOOT_INFO = {
  food: { label: 'CANNED FOOD', color: 0xc5a454 },
  water: { label: 'WATER BOTTLE', color: 0x75a7b2 },
  med: { label: 'BANDAGE', color: 0xd8d1b8 },
  ammo: { label: 'PISTOL AMMO', color: 0xb99e63 },
  rifleAmmo: { label: 'RIFLE AMMO', color: 0xb99e63 },
  rifle: { label: 'MOSIN RIFLE', color: 0x8b7355 },
};

export const state = {
  started: false,
  paused: false,
  ended: false,
  won: false,
  elapsed: 0,
  gameHour: START_HOUR,
  health: 100,
  hunger: 74,
  thirst: 66,
  stamina: 100,
  weapon: WEAPONS.pistol,
  mag: WEAPONS.pistol.magSize,
  reserve: 24,
  inventory: { food: 1, water: 1, med: 1 },
  kills: 0,
  looted: 0,
  reloading: false,
  reloadStart: 0,
  reloadEnd: 0,
  lastShot: -10,
  fireHeld: false,
  sprintHeld: false,
  joyX: 0,
  joyY: 0,
  yaw: 0,
  pitch: 0.065,
  near: null,
  hurtCooldown: 0,
  useCooldown: 0,
  shake: 0,
  stepAccumulator: 0,
  heartTimer: 0,
  soundOn: true,
  aimHintTimer: 0,
  zombieSpawnTimer: 14,
  zombieLimit: QUALITY === 'low' ? 8 : 10,
};
