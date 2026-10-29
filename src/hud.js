import {
  DAWN_HOUR,
  DAY_SECONDS,
  LOOT_INFO,
  clamp,
  formatClock,
  state,
  touchUi,
} from './config.js';
import { ui } from './dom.js';

const compassLabels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const vitalRows = {};

export function initHud() {
  buildCompass();
  buildMagPips();
  refreshAmmo();
  refreshInventory();
  if (touchUi) ui.interactKey.textContent = 'USE';
  for (const name of ['health', 'hunger', 'thirst', 'stamina']) {
    vitalRows[name] = document.querySelector(`.vital[data-vital="${name}"]`);
  }
}

export function buildCompass() {
  ui.compass.innerHTML = '';
  for (let degree = -360; degree <= 720; degree += 15) {
    const span = document.createElement('span');
    const normalized = ((degree % 360) + 360) % 360;
    const isMajor = normalized % 45 === 0;
    span.className = `compass-mark${isMajor ? ' major' : ' tick'}`;
    span.textContent = isMajor ? compassLabels[Math.round(normalized / 45) % 8] : '';
    ui.compass.appendChild(span);
  }
}

export function updateCompass(yaw) {
  const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  const offset = 588 + (heading / 15) * 24;
  ui.compass.style.transform = `translateX(${-offset}px)`;
}

export function buildMagPips() {
  ui.magPips.innerHTML = '';
  for (let i = 0; i < state.weapon.magSize; i += 1) {
    ui.magPips.appendChild(document.createElement('i'));
  }
  refreshAmmo();
}

export function refreshAmmo() {
  ui.magCount.textContent = state.mag;
  ui.reserveCount.textContent = state.reserve;
  ui.weaponName.textContent = state.weapon.name;
  const pips = ui.magPips.children;
  for (let i = 0; i < pips.length; i += 1) {
    pips[i].classList.toggle('loaded', i < state.mag);
  }
}

export function refreshInventory() {
  ui.foodCount.textContent = state.inventory.food;
  ui.waterCount.textContent = state.inventory.water;
  ui.medCount.textContent = state.inventory.med;
  if (ui.slots[0]) ui.slots[0].classList.toggle('empty', state.inventory.food <= 0);
  if (ui.slots[1]) ui.slots[1].classList.toggle('empty', state.inventory.water <= 0);
  if (ui.slots[2]) ui.slots[2].classList.toggle('empty', state.inventory.med <= 0);
}

function formatGameClock(gameHour) {
  const day = Math.floor(gameHour / 24) + 1;
  const hour = Math.floor(((gameHour % 24) + 24) % 24);
  const minute = Math.floor((gameHour - Math.floor(gameHour)) * 60);
  return `D${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function updateHud() {
  const health = clamp(state.health, 0, 100);
  const hunger = clamp(state.hunger, 0, 100);
  const thirst = clamp(state.thirst, 0, 100);
  const stamina = clamp(state.stamina, 0, 100);

  ui.healthBar.style.transform = `scaleX(${health / 100})`;
  ui.hungerBar.style.transform = `scaleX(${hunger / 100})`;
  ui.thirstBar.style.transform = `scaleX(${thirst / 100})`;
  ui.staminaBar.style.transform = `scaleX(${stamina / 100})`;
  ui.healthValue.textContent = Math.round(health);
  ui.hungerValue.textContent = Math.round(hunger);
  ui.thirstValue.textContent = Math.round(thirst);
  ui.staminaValue.textContent = Math.round(stamina);

  vitalRows.health?.classList.toggle('critical', health < 30);
  vitalRows.hunger?.classList.toggle('critical', hunger < 22);
  vitalRows.thirst?.classList.toggle('critical', thirst < 22);
  vitalRows.stamina?.classList.toggle('critical', stamina < 18);

  ui.clock.textContent = formatGameClock(state.gameHour);
  const remaining = (DAWN_HOUR - state.gameHour) * (DAY_SECONDS / 24);
  ui.dawnLabel.textContent = remaining > 0 ? `DAWN IN ${formatClock(remaining)}` : 'DAWN';
  const hour = ((state.gameHour % 24) + 24) % 24;
  const temp = Math.round(14 - Math.max(0, -Math.sin((hour / 24 - 0.25) * Math.PI * 2)) * 7);
  ui.weather.textContent = `${hour > 20 || hour < 6 ? 'CLEAR NIGHT' : 'CLEAR'} · ${temp}°C`;
  ui.killCount.textContent = state.kills;
  ui.lootCount.textContent = state.looted;
}

export function setInteract(near) {
  if (!near) {
    ui.interactWrap.classList.remove('show');
    return;
  }
  ui.interactWrap.classList.add('show');
  ui.interactLabel.textContent = near.type === 'well'
    ? 'DRINK FROM WELL'
    : `PICK UP ${LOOT_INFO[near.pickup.type].label}`;
}

export function showToast(message, tone = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  ui.toastStack.appendChild(toast);
  while (ui.toastStack.children.length > 4) ui.toastStack.firstElementChild.remove();
  window.setTimeout(() => toast.remove(), 2900);
}

export function showHitmarker(kill = false) {
  ui.hitmarker.classList.remove('show');
  void ui.hitmarker.offsetWidth;
  ui.hitmarker.classList.toggle('kill', kill);
  ui.hitmarker.classList.add('show');
}

export function flashDamage() {
  ui.damageFlash.style.opacity = '0.75';
  window.setTimeout(() => { ui.damageFlash.style.opacity = '0'; }, 130);
}

export function flashHeal() {
  ui.healFlash.style.opacity = '0.7';
  window.setTimeout(() => { ui.healFlash.style.opacity = '0'; }, 320);
}

export function setReloadRing(visible, progress = 0) {
  ui.reloadRing.classList.toggle('show', visible);
  if (visible) {
    const circumference = 2 * Math.PI * 20;
    ui.reloadProgress.style.strokeDashoffset = String(circumference * (1 - clamp(progress, 0, 1)));
  }
}

export function showLocation() {
  ui.locationBanner.classList.remove('show');
  void ui.locationBanner.offsetWidth;
  ui.locationBanner.classList.add('show');
}

export function showAimHint() {
  if (!touchUi) ui.aimHint.classList.add('show');
}

export function hideAimHint() {
  ui.aimHint.classList.remove('show');
}

export function updateSoundButton() {
  ui.soundBtn.classList.toggle('muted', !state.soundOn);
}

export function showEndScreen(won) {
  ui.end.classList.remove('hidden');
  ui.end.classList.toggle('is-win', won);
  ui.endEyebrow.textContent = won ? 'TRANSMISSION RECEIVED' : 'SIGNAL LOST';
  ui.endTitle.textContent = won ? 'YOU MADE IT' : 'YOU DIED';
  ui.endCopy.textContent = won
    ? 'Dawn breaks over the dead zone. You survived the night. For now.'
    : 'The dead zone keeps what it takes. Scavenge smarter. Move quieter.';
  ui.endTime.textContent = formatClock(state.elapsed);
  ui.endKills.textContent = state.kills;
  ui.endLoot.textContent = state.looted;
  ui.interactWrap.classList.remove('show');
}
