import { CITY } from './world.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      cash: $('cash'),
      health: $('healthFill'),
      wanted: $('wanted'),
      missionNum: $('missionNum'),
      missionTitle: $('missionTitle'),
      missionDesc: $('missionDesc'),
      missionDist: $('missionDist'),
      mission: $('mission'),
      speedo: $('speedo'),
      speed: $('speed'),
      speedFill: $('speedFill'),
      gear: $('gear'),
      toasts: $('toasts'),
      area: $('areaName'),
      hint: $('vehicleHint'),
      crosshair: $('crosshair'),
      hitmarker: $('hitmarker'),
      minimap: $('minimap'),
      pause: $('pause'),
      wasted: $('wasted'),
      menu: $('menu'),
      btnAction: $('btnAction'),
      btnFire: $('btnFire'),
      btnSprint: $('btnSprint'),
      btnBrake: $('btnBrake'),
      stickZone: $('stickZone')
    };
    this.ctx = this.el.minimap.getContext('2d');
    this.mapSize = 220;
    this.stars = [];
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('i');
      this.el.wanted.appendChild(s);
      this.stars.push(s);
    }
    this.lastWanted = -1;
    this.lastCash = null;
    this.lastHealth = null;
    this.lastArea = '';
    this.mapTick = 0;
    this.crosshairVisible = true;
  }

  showGame() {
    this.el.hud.classList.remove('hidden');
    this.el.menu.classList.add('hidden');
  }

  hideGame() {
    this.el.hud.classList.add('hidden');
  }

  setCash(value) {
    if (value === this.lastCash) return;
    this.lastCash = value;
    this.el.cash.textContent = '$' + Math.max(0, Math.floor(value)).toLocaleString('en-US');
  }

  setHealth(value, max) {
    const pct = Math.max(0, Math.min(1, value / max));
    const key = Math.round(pct * 100);
    if (key === this.lastHealth) return;
    this.lastHealth = key;
    this.el.health.style.width = (pct * 100).toFixed(1) + '%';
    this.el.health.classList.toggle('low', pct < 0.3);
  }

  setWanted(stars, flash = false) {
    const s = Math.max(0, Math.min(5, Math.ceil(stars)));
    if (s !== this.lastWanted) {
      this.lastWanted = s;
      this.stars.forEach((el, i) => el.classList.toggle('on', i < s));
    }
    this.el.wanted.classList.toggle('flash', flash && s > 0);
  }

  setMission(index, total, title, desc) {
    this.el.missionNum.textContent = String(Math.min(index + 1, total)).padStart(2, '0');
    this.el.missionTitle.textContent = title;
    this.el.missionDesc.textContent = desc;
    this.el.mission.style.animation = 'none';
    void this.el.mission.offsetWidth;
    this.el.mission.style.animation = '';
  }

  setMissionDistance(dist) {
    if (dist === null || !isFinite(dist)) {
      this.el.missionDist.textContent = 'FREE ROAM';
    } else {
      this.el.missionDist.textContent = Math.round(dist) + ' M TO MARKER';
    }
  }

  setDriving(driving) {
    this.el.speedo.classList.toggle('hidden', !driving);
    this.el.btnAction.querySelector('span').textContent = driving ? 'EXIT' : 'ENTER';
    this.el.btnFire.classList.toggle('hidden', driving);
    this.el.btnSprint.classList.toggle('hidden', driving);
    this.el.btnBrake.classList.toggle('hidden', !driving);
    this.el.crosshair.style.display = driving ? 'none' : 'block';
    this.el.btnAction.classList.toggle('driving', driving);
  }

  setSpeed(speed, maxSpeed) {
    const mph = Math.round(Math.abs(speed) * 2.08);
    this.el.speed.textContent = mph;
    this.el.speedFill.style.width = Math.min(100, (Math.abs(speed) / maxSpeed) * 100) + '%';
    this.el.gear.textContent = speed < -0.4 ? 'R' : (speed < 0.4 ? 'N' : 'D');
  }

  setArea(name) {
    if (name === this.lastArea) return;
    this.lastArea = name;
    this.el.area.textContent = name;
    this.el.area.style.opacity = '0';
    setTimeout(() => { this.el.area.style.opacity = '1'; }, 30);
  }

  setVehicleHint(show, text) {
    if (text) this.el.hint.textContent = text;
    this.el.hint.classList.toggle('hidden', !show);
  }

  toast(text, kind = '', duration = 2600) {
    const node = document.createElement('div');
    node.className = 'toast ' + kind;
    node.textContent = text;
    this.el.toasts.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .3s, transform .3s';
      node.style.opacity = '0';
      node.style.transform = 'translateY(-4px)';
      setTimeout(() => node.remove(), 320);
    }, duration);
  }

  hitmarker() {
    const h = this.el.hitmarker;
    h.classList.remove('show');
    void h.offsetWidth;
    h.classList.add('show');
  }

  showWasted(show) {
    this.el.wasted.classList.toggle('hidden', !show);
  }

  showPause(show) {
    this.el.pause.classList.toggle('hidden', !show);
  }

  updateMinimap(dt, data) {
    this.mapTick += dt;
    if (this.mapTick < 0.065) return;
    this.mapTick = 0;
    const ctx = this.ctx;
    const size = this.mapSize;
    const pad = 10;
    const span = 600;
    const scale = (size - pad * 2) / span;
    const toX = (x) => pad + (x + 300) * scale;
    const toY = (z) => pad + (z + 300) * scale;

    ctx.clearRect(0, 0, size, size);
    const bg = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
    bg.addColorStop(0, '#101d30');
    bg.addColorStop(1, '#070d18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // roads
    ctx.strokeStyle = '#20344e';
    ctx.lineWidth = 7 * scale * 60 / 60;
    ctx.lineWidth = Math.max(2.5, 14 * scale);
    for (let i = -4; i <= 4; i++) {
      const c = i * 60;
      ctx.beginPath();
      ctx.moveTo(toX(c), toY(-240));
      ctx.lineTo(toX(c), toY(240));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(-240), toY(c));
      ctx.lineTo(toX(240), toY(c));
      ctx.stroke();
    }
    // blocks
    ctx.fillStyle = '#1a2a40';
    for (let bx = -210; bx <= 210; bx += 60) {
      for (let bz = -210; bz <= 210; bz += 60) {
        const x = toX(bx - 23);
        const y = toY(bz - 23);
        const w = 46 * scale;
        ctx.fillRect(x, y, w, w);
      }
    }
    // beach
    ctx.fillStyle = 'rgba(201,167,122,0.16)';
    ctx.fillRect(0, toY(262), size, size - toY(262));

    // mission marker
    if (data.mission && data.mission.visible) {
      const mx = toX(data.mission.x);
      const my = toY(data.mission.z);
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.18;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 9;
      ctx.strokeRect(-5 * pulse, -5 * pulse, 10 * pulse, 10 * pulse);
      ctx.fillStyle = 'rgba(255,209,102,0.5)';
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    }

    // pickups
    if (data.pickups) {
      ctx.fillStyle = 'rgba(99,255,176,0.8)';
      for (const p of data.pickups) {
        if (!p.active) continue;
        ctx.beginPath();
        ctx.arc(toX(p.x), toY(p.z), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // traffic
    if (data.traffic) {
      ctx.fillStyle = 'rgba(180,205,235,0.45)';
      for (const c of data.traffic) {
        ctx.fillRect(toX(c.pos.x) - 1, toY(c.pos.z) - 1, 2, 2);
      }
    }

    // cops
    if (data.cops) {
      const t = performance.now() * 0.006;
      data.cops.forEach((c, i) => {
        ctx.fillStyle = Math.sin(t + i) > 0 ? '#ff2f4a' : '#3b8dff';
        ctx.beginPath();
        ctx.arc(toX(c.pos.x), toY(c.pos.z), 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // player
    if (data.player) {
      const px = toX(data.player.x);
      const py = toY(data.player.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-data.player.heading + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.4, 4.5);
      ctx.lineTo(0, 2.6);
      ctx.lineTo(-4.4, 4.5);
      ctx.closePath();
      ctx.fillStyle = '#f4feff';
      ctx.shadowColor = '#34e5ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }

    // scanlines and rim
    ctx.strokeStyle = 'rgba(52,229,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
