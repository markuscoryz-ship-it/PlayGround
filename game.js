(function () {
  'use strict';

  var DATA = window.AURORA_DATA;
  var LEVELS = DATA.LEVELS;
  var THEMES = DATA.THEMES;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });
  var WORLD_W = 480;
  var WORLD_H = 800;
  var TAU = Math.PI * 2;
  var HINTS = LEVELS.map(function (level) { return level.hint; });

  var ui = {
    title: document.getElementById('titleScreen'),
    pause: document.getElementById('pauseScreen'),
    win: document.getElementById('winScreen'),
    start: document.getElementById('startBtn'),
    resume: document.getElementById('resumeBtn'),
    restart: document.getElementById('restartBtn'),
    again: document.getElementById('againBtn'),
    tilt: document.getElementById('tiltBtn'),
    tiltTitle: document.getElementById('tiltTitleBtn'),
    sound: document.getElementById('soundBtn'),
    roomNo: document.getElementById('roomNo'),
    roomName: document.getElementById('roomName'),
    banner: document.getElementById('roomBanner'),
    bannerNo: document.getElementById('bannerNo'),
    bannerName: document.getElementById('bannerName'),
    time: document.getElementById('time'),
    deaths: document.getElementById('deaths'),
    berries: document.getElementById('berries'),
    hint: document.getElementById('hint'),
    toast: document.getElementById('toast'),
    joystick: document.getElementById('joystick'),
    stick: document.getElementById('stick'),
    jump: document.getElementById('jumpBtn'),
    dash: document.getElementById('dashBtn'),
    winTime: document.getElementById('winTime'),
    winDeaths: document.getElementById('winDeaths'),
    winBerries: document.getElementById('winBerries')
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, amount) { return a + (b - a) * amount; }
  function smooth(value) {
    var t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }
  function hash(value) {
    var x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function formatTime(seconds) {
    var minutes = Math.floor(seconds / 60);
    var rest = seconds - minutes * 60;
    return minutes + ':' + (rest < 10 ? '0' : '') + rest.toFixed(1);
  }
  function rr(x, y, width, height, radius) {
    var r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  var held = { jump: false, dash: false };
  var pressed = { jump: false, dash: false };
  var keys = new Set();
  var input = { x: 0, y: 0, jumpHeld: false, jumpPressed: false, dashPressed: false, dashHeld: false };
  var joy = { x: 0, y: 0, active: false, pointer: null };

  var player = {
    x: 0, y: 0, w: 14, h: 22, vx: 0, vy: 0, facing: 1,
    grounded: false, coyote: 0, wallDir: 0, wallSliding: false,
    jumpBuffer: 0, dashBuffer: 0, dashTimer: 0, dashCooldown: 0,
    canDash: true, dashDirX: 0, dashDirY: 0, wallJumpLock: 0,
    runCycle: 0, squash: 1, dead: false
  };

  var state = {
    mode: 'title',
    roomIndex: 0,
    room: null,
    elapsed: 0,
    deaths: 0,
    berrySet: new Set(),
    deathTimer: 0,
    transition: 0,
    transitionSwitched: false,
    shake: 0,
    flash: 0,
    deathFlash: 0,
    time: 0,
    hintTimer: 0,
    bannerTimer: 0
  };

  var trail = [];
  var particles = [];
  var motes = [];
  var snowBack = [];
  var snowFront = [];
  var stars = [];
  var mountains = [];

  var view = {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: 1,
    stage: { x: 0, y: 0, w: WORLD_W, h: WORLD_H, scale: 1 },
    touchLayout: false
  };

  var audio = null;
  var quality = 1;
  var qualityFrames = 0;
  var qualityElapsed = 0;
  var muted = false;
  var tiltEnabled = false;
  var tiltSupported = 'DeviceOrientationEvent' in window;
  var tiltCenter = null;
  var tiltValue = 0;
  var tiltTarget = 0;

  function ensureAudio() {
    if (audio) {
      if (audio.state === 'suspended') audio.resume().catch(function () {});
      return;
    }
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audio = new AudioContextClass();
    } catch (error) {
      audio = null;
    }
  }

  function tone(start, duration, type, volume, from, to, attack) {
    if (!audio || muted) return;
    var now = audio.currentTime + start;
    var osc = audio.createOscillator();
    var gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + (attack || 0.008));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(start, duration, volume, highpass) {
    if (!audio || muted) return;
    var length = Math.max(1, Math.floor(audio.sampleRate * duration));
    var buffer = audio.createBuffer(1, length, audio.sampleRate);
    var data = buffer.getChannelData(0);
    for (var index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    var source = audio.createBufferSource();
    source.buffer = buffer;
    var filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass || 300;
    var gain = audio.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    source.start(audio.currentTime + start);
  }

  var sfx = {
    jump: function () { tone(0, 0.12, 'triangle', 0.035, 290, 540, 0.005); },
    wallJump: function () {
      tone(0, 0.13, 'square', 0.025, 220, 480, 0.004);
      noise(0, 0.06, 0.018, 900);
    },
    dash: function () {
      tone(0, 0.19, 'sawtooth', 0.04, 620, 115, 0.004);
      noise(0, 0.14, 0.025, 500);
    },
    land: function () { tone(0, 0.07, 'sine', 0.02, 120, 70, 0.002); },
    death: function () {
      tone(0, 0.45, 'sawtooth', 0.05, 250, 48, 0.004);
      noise(0, 0.5, 0.04, 160);
    },
    crystal: function () {
      tone(0, 0.18, 'sine', 0.045, 880, 1540, 0.003);
      tone(0.04, 0.2, 'triangle', 0.025, 1320, 1760, 0.003);
    },
    berry: function () {
      tone(0, 0.14, 'sine', 0.035, 980, 1320, 0.003);
      tone(0.08, 0.18, 'sine', 0.025, 1320, 1760, 0.003);
    },
    door: function () {
      tone(0, 0.7, 'sine', 0.03, 220, 440, 0.06);
      tone(0.08, 0.7, 'triangle', 0.022, 330, 660, 0.06);
      noise(0, 0.3, 0.015, 1200);
    },
    win: function () {
      [440, 554, 659, 880, 1108].forEach(function (frequency, index) {
        tone(index * 0.11, 0.55, 'sine', 0.03, frequency, frequency, 0.01);
      });
    },
    tick: function () { tone(0, 0.04, 'sine', 0.012, 660, 660, 0.002); }
  };

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.dpr = dpr;
    canvas.width = Math.max(1, Math.round(view.w * dpr));
    canvas.height = Math.max(1, Math.round(view.h * dpr));
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
    view.touchLayout = window.matchMedia('(pointer: coarse)').matches || view.w <= 820;
    var top = view.w <= 720 ? 76 : 84;
    var bottom = view.touchLayout ? 154 : 18;
    var availableWidth = view.w - 24;
    var availableHeight = view.h - top - bottom;
    var scale = Math.min(availableWidth / WORLD_W, availableHeight / WORLD_H);
    scale = Math.min(scale, 1.35);
    scale = Math.max(scale, 0.18);
    var width = WORLD_W * scale;
    var height = WORLD_H * scale;
    view.stage = {
      x: (view.w - width) / 2,
      y: top + Math.max(0, (availableHeight - height) / 2),
      w: width,
      h: height,
      scale: scale
    };
  }

  function buildAmbient() {
    stars.length = 0;
    snowBack.length = 0;
    snowFront.length = 0;
    motes.length = 0;
    var index;
    for (index = 0; index < 100; index += 1) {
      stars.push({
        x: hash(index * 1.31) * WORLD_W,
        y: hash(index * 2.73) * 500,
        size: 0.35 + hash(index * 4.7) * 1.35,
        phase: hash(index * 6.1) * TAU,
        speed: 0.2 + hash(index * 8.3) * 0.7
      });
    }
    for (index = 0; index < 74; index += 1) {
      snowBack.push({
        x: Math.random() * view.w,
        y: Math.random() * view.h,
        size: 0.7 + Math.random() * 2.1,
        speed: 8 + Math.random() * 25,
        drift: 12 + Math.random() * 28,
        phase: Math.random() * TAU,
        alpha: 0.15 + Math.random() * 0.42
      });
    }
    for (index = 0; index < 24; index += 1) {
      snowFront.push({
        x: Math.random() * view.w,
        y: Math.random() * view.h,
        size: 0.6 + Math.random() * 1.5,
        speed: 2 + Math.random() * 8,
        drift: 3 + Math.random() * 10,
        phase: Math.random() * TAU,
        alpha: 0.08 + Math.random() * 0.22
      });
    }
    for (index = 0; index < 34; index += 1) {
      motes.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        size: 0.4 + Math.random() * 1.5,
        speed: 2 + Math.random() * 8,
        phase: Math.random() * TAU,
        alpha: 0.1 + Math.random() * 0.32
      });
    }
    mountains.length = 0;
    for (var layer = 0; layer < 3; layer += 1) {
      var points = [];
      var count = 18;
      for (index = 0; index <= count; index += 1) {
        var x = (index / count) * (view.w + 200) - 100;
        var ridge = Math.sin(index * 1.8 + layer * 2.2) * (0.5 + layer * 0.18);
        var random = hash(index * 7.3 + layer * 19.7);
        var y = view.h * (0.52 + layer * 0.12) + ridge * view.h * 0.08 + random * view.h * 0.1;
        points.push({ x: x, y: y });
      }
      mountains.push(points);
    }
  }

  function makeRoom(index) {
    var level = LEVELS[index];
    var room = {
      index: index,
      solids: [
        { x: 0, y: 0, w: 12, h: 800, wall: true, edge: 'left' },
        { x: 468, y: 0, w: 12, h: 800, wall: true, edge: 'right' },
        { x: 0, y: -70, w: 480, h: 70, hidden: true }
      ],
      spikes: level.spikes.map(function (item, itemIndex) {
        return { x: item.x, y: item.y, w: item.w, h: item.h, id: itemIndex };
      }),
      crystals: level.crystals.map(function (item, itemIndex) {
        return { x: item.x, y: item.y, active: true, respawn: 0, phase: hash(index * 9 + itemIndex) * TAU, id: itemIndex };
      }),
      berries: level.berries.map(function (item, itemIndex) {
        return { x: item.x, y: item.y, active: !state.berrySet.has(index + ':' + itemIndex), phase: hash(index * 13 + itemIndex) * TAU, id: itemIndex };
      }),
      door: { x: level.door.x, y: level.door.y, w: level.door.w, h: level.door.h },
      spawn: { x: level.spawn.x, y: level.spawn.y },
      theme: THEMES[index]
    };
    level.solids.forEach(function (item) {
      room.solids.push({
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        wall: item.wall,
        edge: item.edge,
        oneWay: item.h <= 24 && item.w >= 60
      });
    });
    return room;
  }

  function resetPlayer() {
    var spawn = state.room.spawn;
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.grounded = false;
    player.coyote = 0;
    player.wallDir = 0;
    player.wallSliding = false;
    player.jumpBuffer = 0;
    player.dashBuffer = 0;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.canDash = true;
    player.dashDirX = 0;
    player.dashDirY = 0;
    player.wallJumpLock = 0;
    player.runCycle = 0;
    player.squash = 1;
    player.dead = false;
    trail.length = 0;
  }

  function loadRoom(index, showIntro) {
    state.roomIndex = index;
    state.room = makeRoom(index);
    resetPlayer();
    state.shake = 0;
    state.flash = 0.5;
    state.deathFlash = 0;
    updateRoomUI(showIntro !== false);
    if (showIntro !== false) {
      var hint = HINTS[index];
      if (view.touchLayout && index === 0) hint = 'Move with the joystick. Tap JUMP to leap and DASH to cross big gaps.';
      setHint(hint, 6.2);
    }
  }

  function updateRoomUI(showBanner) {
    var level = LEVELS[state.roomIndex];
    var number = String(state.roomIndex + 1).padStart(2, '0');
    ui.roomNo.textContent = number;
    ui.roomName.textContent = level.name;
    ui.bannerNo.textContent = 'SCREEN ' + number;
    ui.bannerName.textContent = level.name;
    if (showBanner) {
      ui.banner.classList.remove('show');
      void ui.banner.offsetWidth;
      ui.banner.classList.add('show');
      state.bannerTimer = 2.4;
    }
  }

  function setHint(text, duration) {
    if (!text) return;
    ui.hint.textContent = text;
    ui.hint.classList.add('show');
    state.hintTimer = duration || 5;
  }

  function showToast(text, duration) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { ui.toast.classList.remove('show'); }, (duration || 2.1) * 1000);
  }

  function updateBerries() {
    var count = state.berrySet.size;
    ui.berries.textContent = count;
    ui.winBerries.textContent = count + ' / 15';
  }

  function startGame() {
    ensureAudio();
    if (audio && audio.state === 'suspended') audio.resume().catch(function () {});
    document.body.classList.remove('title-active');
    ui.title.classList.add('hidden');
    ui.title.setAttribute('aria-hidden', 'true');
    state.mode = 'playing';
    state.elapsed = 0;
    state.deaths = 0;
    state.berrySet.clear();
    state.deathTimer = 0;
    state.hintTimer = 0;
    state.bannerTimer = 0;
    pressed.jump = false;
    pressed.dash = false;
    ui.deaths.textContent = '0';
    updateBerries();
    loadRoom(0, true);
    state.flash = 1;
    state.shake = 5;
    sfx.door();
  }

  function restartRun() {
    ui.win.classList.add('hidden');
    ui.win.setAttribute('aria-hidden', 'true');
    startGame();
  }

  function restartRoom() {
    if (state.mode !== 'playing' && state.mode !== 'dying') return;
    state.mode = 'playing';
    state.deaths += 1;
    ui.deaths.textContent = String(state.deaths);
    hidePause();
    state.room.crystals.forEach(function (item) {
      item.active = true;
      item.respawn = 0;
    });
    resetPlayer();
    state.flash = 0.8;
    state.shake = 5;
    sfx.tick();
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    ui.pause.classList.remove('hidden');
    ui.pause.setAttribute('aria-hidden', 'false');
  }

  function hidePause() {
    ui.pause.classList.add('hidden');
    ui.pause.setAttribute('aria-hidden', 'true');
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    hidePause();
    ensureAudio();
  }

  function die() {
    if (state.mode !== 'playing') return;
    state.mode = 'dying';
    state.deathTimer = 0;
    state.deaths += 1;
    state.shake = 16;
    state.deathFlash = 1;
    player.dead = true;
    player.vx = 0;
    player.vy = 0;
    ui.deaths.textContent = String(state.deaths);
    burst(player.x + player.w / 2, player.y + player.h / 2, 30, ['#ff6b72', '#ffd166', '#e8fbff'], 250);
    sfx.death();
  }

  function respawn() {
    state.mode = 'playing';
    state.deathTimer = 0;
    state.room.crystals.forEach(function (item) {
      item.active = true;
      item.respawn = 0;
    });
    resetPlayer();
    state.flash = 0.65;
    state.shake = 5;
    trail.length = 0;
    sfx.tick();
  }

  function reachDoor() {
    if (state.mode !== 'playing') return;
    player.vx = 0;
    player.vy = 0;
    burst(state.room.door.x + state.room.door.w / 2, state.room.door.y + state.room.door.h / 2, 38, ['#d9fbff', THEMES[state.roomIndex].accent, '#ffffff'], 190);
    state.shake = 8;
    sfx.door();
    if (state.roomIndex >= LEVELS.length - 1) {
      winGame();
      return;
    }
    state.mode = 'transition';
    state.transition = 0;
    state.transitionSwitched = false;
  }

  function winGame() {
    state.mode = 'won';
    state.elapsed = Math.max(state.elapsed, 0.1);
    ui.winTime.textContent = formatTime(state.elapsed);
    ui.winDeaths.textContent = String(state.deaths);
    updateBerries();
    ui.win.classList.remove('hidden');
    ui.win.setAttribute('aria-hidden', 'false');
    sfx.win();
    var colors = ['#ffd166', '#ff9b71', '#5be4c5', '#ffffff'];
    for (var index = 0; index < 6; index += 1) {
      window.setTimeout(function () {
        var x = state.room.door.x + state.room.door.w / 2 + (Math.random() - 0.5) * 200;
        var y = 150 + Math.random() * 260;
        burst(x, y, 24, colors, 210);
      }, index * 130);
    }
  }

  function burst(x, y, count, colors, speed) {
    for (var index = 0; index < count; index += 1) {
      var angle = Math.random() * TAU;
      var velocity = speed * (0.2 + Math.random() * 0.8);
      var life = 0.45 + Math.random() * 0.8;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 20,
        life: life,
        maxLife: life,
        size: 1 + Math.random() * 3.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 260,
        shape: Math.random() > 0.7 ? 'spark' : 'dot',
        spin: (Math.random() - 0.5) * 12,
        angle: Math.random() * TAU
      });
    }
    if (particles.length > 650) particles.splice(0, particles.length - 650);
  }

  function dust(x, y, direction, count, color) {
    for (var index = 0; index < (count || 4); index += 1) {
      var life = 0.25 + Math.random() * 0.4;
      particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 4,
        vx: direction * (15 + Math.random() * 45) + (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 30,
        life: life,
        maxLife: life,
        size: 0.8 + Math.random() * 1.8,
        color: color || '#b9dfe6',
        gravity: 20,
        shape: 'dot',
        spin: 0,
        angle: 0
      });
    }
  }

  function updateParticles(dt) {
    for (var index = particles.length - 1; index >= 0; index -= 1) {
      var particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.angle += particle.spin * dt;
    }
  }

  function updateSnow(dt) {
    var wind = 12 + Math.sin(state.time * 0.31) * 8;
    var index;
    for (index = 0; index < snowBack.length; index += 1) {
      var flake = snowBack[index];
      flake.x += (flake.drift + wind) * dt;
      flake.y += flake.speed * dt;
      if (flake.y > view.h + 8) { flake.y = -8; flake.x = Math.random() * view.w; }
      if (flake.x > view.w + 8) flake.x = -8;
    }
    for (index = 0; index < snowFront.length; index += 1) {
      var front = snowFront[index];
      front.x += (front.drift * 0.35 + wind * 0.25) * dt;
      front.y += front.speed * dt;
      if (front.y > view.h + 8) { front.y = -8; front.x = Math.random() * view.w; }
      if (front.x > view.w + 8) front.x = -8;
    }
    for (index = 0; index < motes.length; index += 1) {
      var mote = motes[index];
      mote.y -= mote.speed * dt;
      mote.x += Math.sin(state.time * 0.5 + mote.phase) * 3 * dt;
      if (mote.y < -8) { mote.y = WORLD_H + 8; mote.x = Math.random() * WORLD_W; }
    }
  }

  function updateInput() {
    var x = 0;
    var y = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
    x += joy.x;
    y += joy.y;
    if (tiltEnabled) {
      var target = Math.abs(tiltTarget) < 0.07 ? 0 : tiltTarget;
      tiltValue = lerp(tiltValue, target, 0.16);
      x += tiltValue;
    }
    if (Math.abs(x) < 0.12) x = 0;
    if (Math.abs(y) < 0.12) y = 0;
    input.x = clamp(x, -1, 1);
    input.y = clamp(y, -1, 1);
    input.jumpHeld = keys.has('Space') || keys.has('KeyZ') || held.jump;
    input.dashHeld = keys.has('KeyX') || keys.has('ShiftLeft') || keys.has('ShiftRight') || held.dash;
    input.jumpPressed = pressed.jump;
    input.dashPressed = pressed.dash;
  }

  function doJump() {
    player.vy = -470;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.squash = 0.78;
    dust(player.x + player.w / 2, player.y + player.h, 1, 4);
    sfx.jump();
  }

  function doWallJump() {
    var direction = player.wallDir === 1 ? -1 : 1;
    player.vx = direction * 258;
    player.vy = -432;
    player.facing = direction;
    player.wallJumpLock = 0.17;
    player.jumpBuffer = 0;
    player.grounded = false;
    player.coyote = 0;
    player.wallSliding = false;
    player.squash = 0.84;
    dust(player.x + (player.wallDir === 1 ? player.w : 0), player.y + player.h * 0.55, direction, 6, '#d9fbff');
    state.shake = Math.max(state.shake, 2.4);
    sfx.wallJump();
  }

  function startDash() {
    var dx = input.x;
    var dy = input.y;
    if (Math.abs(dx) < 0.18 && Math.abs(dy) < 0.18) {
      dx = player.facing;
      dy = 0;
    }
    var length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    player.dashDirX = dx;
    player.dashDirY = dy;
    player.vx = dx * 585;
    player.vy = dy * 585;
    player.dashTimer = 0.155;
    player.dashCooldown = 0.08;
    player.canDash = false;
    player.dashBuffer = 0;
    player.wallSliding = false;
    player.wallJumpLock = 0;
    player.facing = dx >= 0 ? 1 : -1;
    player.squash = 0.9;
    state.shake = Math.max(state.shake, 4.5);
    state.flash = Math.max(state.flash, 0.16);
    for (var index = 0; index < 12; index += 1) {
      var life = 0.25 + Math.random() * 0.35;
      particles.push({
        x: player.x + player.w / 2,
        y: player.y + player.h / 2,
        vx: -dx * (60 + Math.random() * 130) + (Math.random() - 0.5) * 40,
        vy: -dy * (60 + Math.random() * 130) + (Math.random() - 0.5) * 40,
        life: life,
        maxLife: life,
        size: 1.2 + Math.random() * 3,
        color: index % 3 === 0 ? '#ffffff' : (index % 3 === 1 ? '#5be4c5' : '#ff9b71'),
        gravity: 0,
        shape: 'spark',
        spin: 0,
        angle: Math.atan2(dy, dx)
      });
    }
    trail.push({ x: player.x, y: player.y, facing: player.facing, life: 0.26, maxLife: 0.26 });
    sfx.dash();
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function moveX(dt) {
    player.x += player.vx * dt;
    player.wallDir = 0;
    var solids = state.room.solids;
    for (var index = 0; index < solids.length; index += 1) {
      var item = solids[index];
      if (item.oneWay) continue;
      if (!intersects(player, item)) continue;
      if (player.vx > 0) {
        player.x = item.x - player.w;
        player.wallDir = 1;
      } else if (player.vx < 0) {
        player.x = item.x + item.w;
        player.wallDir = -1;
      }
      player.vx = 0;
    }
    if (player.x < 0) { player.x = 0; player.wallDir = -1; player.vx = 0; }
    if (player.x + player.w > WORLD_W) { player.x = WORLD_W - player.w; player.wallDir = 1; player.vx = 0; }
  }

  function moveY(dt) {
    var movingDown = player.vy > 0;
    var previousBottom = player.y + player.h;
    player.y += player.vy * dt;
    player.grounded = false;
    var solids = state.room.solids;
    for (var index = 0; index < solids.length; index += 1) {
      var item = solids[index];
      if (item.oneWay && (!movingDown || previousBottom > item.y + 1.5)) continue;
      if (!intersects(player, item)) continue;
      if (player.vy > 0) {
        player.y = item.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else if (player.vy < 0) {
        player.y = item.y + item.h;
        player.vy = 0;
      }
    }
  }

  function probeWall() {
    var epsilon = 1.3;
    player.wallDir = 0;
    for (var index = 0; index < state.room.solids.length; index += 1) {
      var item = state.room.solids[index];
      if (item.hidden || item.oneWay) continue;
      var vertical = player.y + player.h > item.y + 1 && player.y < item.y + item.h - 1;
      if (!vertical) continue;
      if (Math.abs(player.x + player.w - item.x) <= epsilon) player.wallDir = 1;
      if (Math.abs(player.x - (item.x + item.w)) <= epsilon) player.wallDir = -1;
      if (player.wallDir) break;
    }
  }

  function updatePlayer(dt) {
    if (state.mode !== 'playing') return;
    var p = player;
    p.coyote = p.grounded ? 0.105 : Math.max(0, p.coyote - dt);
    p.jumpBuffer = input.jumpPressed ? 0.12 : Math.max(0, p.jumpBuffer - dt);
    p.dashBuffer = input.dashPressed ? 0.1 : Math.max(0, p.dashBuffer - dt);
    p.wallJumpLock = Math.max(0, p.wallJumpLock - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.wallSliding = false;

    if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1;

    if (p.jumpBuffer > 0 && (p.grounded || p.coyote > 0)) {
      doJump();
    } else if (p.jumpBuffer > 0 && !p.grounded && p.wallDir !== 0) {
      doWallJump();
    }

    if (p.dashBuffer > 0 && p.canDash && p.dashCooldown <= 0) startDash();

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashDirX * 585;
      p.vy = p.dashDirY * 585;
      p.runCycle += dt * 18;
      if (p.dashTimer <= 0) {
        p.vx *= 0.58;
        p.vy *= 0.5;
        p.canDash = false;
        dust(p.x + p.w / 2, p.y + p.h / 2, -p.dashDirX, 5, '#a8ffe9');
      }
    } else {
      var acceleration = p.grounded ? 1500 : 1050;
      var maxSpeed = 168;
      var lock = p.wallJumpLock > 0 && Math.sign(input.x) !== Math.sign(p.vx) && Math.abs(p.vx) > 120;
      if (input.x !== 0 && !lock) {
        p.vx += input.x * acceleration * dt;
        p.vx = clamp(p.vx, -maxSpeed, maxSpeed);
      } else {
        var friction = p.grounded ? 1800 : 340;
        if (p.vx > 0) p.vx = Math.max(0, p.vx - friction * dt);
        if (p.vx < 0) p.vx = Math.min(0, p.vx + friction * dt);
      }
      var gravity = p.vy > 0 ? 1540 : 1420;
      p.vy = Math.min(p.vy + gravity * dt, 820);

      if (!p.grounded && p.wallDir !== 0 && input.x === p.wallDir && p.vy > 0) {
        p.wallSliding = true;
        p.vy = Math.min(p.vy, 92);
        if (Math.random() < dt * 30) dust(p.x + (p.wallDir === 1 ? p.w : 0), p.y + p.h * 0.7, -p.wallDir, 1, '#d9fbff');
      }
    }

    if (!p.wallSliding) p.runCycle += Math.abs(p.vx) * dt * 0.055;
    p.squash = lerp(p.squash, 1, Math.min(1, dt * 9));

    var wasGrounded = p.grounded;
    moveX(dt);
    moveY(dt);
    probeWall();

    if (p.grounded) {
      p.canDash = true;
      p.coyote = 0.105;
      if (!wasGrounded && p.vy === 0) {
        p.squash = 1.16;
        sfx.land();
      }
    }

    if (p.wallJumpLock > 0) p.vx = clamp(p.vx, -258, 258);

    if (p.dashTimer > 0) {
      trail.push({ x: p.x, y: p.y, facing: p.facing, life: 0.22, maxLife: 0.22 });
      if (trail.length > 16) trail.shift();
    }

    if (!input.jumpHeld && p.vy < -180 && p.dashTimer <= 0) p.vy = -180;

    updateRoomEntities(dt);
    updateTrail(dt);
    if (checkSpikeDeath()) return;

    if (p.y > WORLD_H + 40) {
      die();
      return;
    }

    var door = state.room.door;
    if (intersects(p, { x: door.x + 5, y: door.y + 10, w: door.w - 10, h: door.h - 8 })) reachDoor();
  }

  function updateRoomEntities(dt) {
    var p = player;
    var index;
    for (index = 0; index < state.room.crystals.length; index += 1) {
      var crystal = state.room.crystals[index];
      if (!crystal.active) {
        crystal.respawn -= dt;
        if (crystal.respawn <= 0) { crystal.active = true; crystal.phase = 0; }
        continue;
      }
      crystal.phase += dt * 1.8;
      if (Math.hypot(p.x + p.w / 2 - crystal.x, p.y + p.h / 2 - crystal.y) < 22) {
        crystal.active = false;
        crystal.respawn = 3.2;
        p.canDash = true;
        p.dashCooldown = 0;
        if (p.dashTimer <= 0) p.coyote = Math.max(p.coyote, 0.07);
        state.flash = Math.max(state.flash, 0.42);
        state.shake = Math.max(state.shake, 3);
        burst(crystal.x, crystal.y, 16, ['#a8ffe9', '#ffffff', '#5be4c5'], 150);
        sfx.crystal();
      }
    }
    for (index = 0; index < state.room.berries.length; index += 1) {
      var berry = state.room.berries[index];
      if (!berry.active) continue;
      berry.phase += dt * 2.3;
      if (Math.hypot(p.x + p.w / 2 - berry.x, p.y + p.h / 2 - berry.y) < 17) {
        berry.active = false;
        state.berrySet.add(state.roomIndex + ':' + berry.id);
        updateBerries();
        burst(berry.x, berry.y, 12, ['#ffd166', '#fff1b8', '#ff9b71'], 120);
        state.flash = Math.max(state.flash, 0.22);
        sfx.berry();
      }
    }
  }

  function checkSpikeDeath() {
    var p = player;
    for (var index = 0; index < state.room.spikes.length; index += 1) {
      var item = state.room.spikes[index];
      if (intersects(p, { x: item.x + 2, y: item.y + 5, w: item.w - 4, h: item.h - 5 })) {
        die();
        return true;
      }
    }
    return false;
  }

  function updateTrail(dt) {
    for (var index = trail.length - 1; index >= 0; index -= 1) {
      trail[index].life -= dt;
      if (trail[index].life <= 0) trail.splice(index, 1);
    }
  }

  function updateTransition(dt) {
    state.transition += dt;
    if (!state.transitionSwitched && state.transition > 0.54) {
      state.transitionSwitched = true;
      loadRoom(state.roomIndex + 1, true);
    }
    if (state.transition > 1.24) {
      state.mode = 'playing';
      state.transition = 0;
      state.transitionSwitched = false;
      state.flash = 0.3;
    }
  }

  function update(dt) {
    state.time += dt;
    updateSnow(dt);
    updateParticles(dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 36);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.6);
    if (state.deathFlash > 0) state.deathFlash = Math.max(0, state.deathFlash - dt * 2.1);

    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) ui.banner.classList.remove('show');
    }
    if (state.hintTimer > 0) {
      state.hintTimer -= dt;
      if (state.hintTimer <= 0) ui.hint.classList.remove('show');
    }

    updateInput();

    if (state.mode === 'title' || state.mode === 'paused' || state.mode === 'won') {
      updateTrail(dt);
      pressed.jump = false;
      pressed.dash = false;
      return;
    }

    if (state.mode === 'transition') {
      updateTrail(dt);
      updateTransition(dt);
      state.elapsed += dt;
      updateHud();
      pressed.jump = false;
      pressed.dash = false;
      return;
    }

    if (state.mode === 'dying') {
      state.deathTimer += dt;
      state.elapsed += dt;
      updateRoomEntities(dt);
      if (state.deathTimer > 0.76) respawn();
      updateHud();
      pressed.jump = false;
      pressed.dash = false;
      return;
    }

    if (state.mode === 'playing') {
      state.elapsed += dt;
      updatePlayer(dt);
      updateHud();
      ui.dash.classList.toggle('depleted', !player.canDash && player.dashTimer <= 0);
    }

    pressed.jump = false;
    pressed.dash = false;
    updateInput();
  }

  function updateHud() {
    ui.time.textContent = formatTime(state.elapsed);
    ui.deaths.textContent = String(state.deaths);
    ui.berries.textContent = String(state.berrySet.size);
  }

  function drawSky() {
    var theme = THEMES[state.roomIndex];
    var gradient = ctx.createLinearGradient(0, 0, 0, view.h);
    gradient.addColorStop(0, theme.skyTop);
    gradient.addColorStop(0.58, theme.skyBottom);
    gradient.addColorStop(1, '#050d18');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.w, view.h);

    var sunX = view.w * (state.roomIndex === 4 ? 0.75 : 0.22);
    var sunY = view.h * (state.roomIndex === 4 ? 0.19 : 0.13);
    var sunRadius = Math.min(view.w, view.h) * (state.roomIndex === 4 ? 0.045 : 0.018);
    var glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 7);
    glow.addColorStop(0, theme.sun + '55');
    glow.addColorStop(0.22, theme.accent + '18');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function drawAurora() {
    var theme = THEMES[state.roomIndex];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var baseY = view.h * 0.2;
    for (var band = 0; band < 3; band += 1) {
      ctx.beginPath();
      var steps = 24;
      for (var index = 0; index <= steps; index += 1) {
        var x = (index / steps) * (view.w + 160) - 80;
        var wave = Math.sin(index * 0.45 + state.time * (0.09 + band * 0.02) + band * 2.1);
        var y = baseY + band * view.h * 0.045 + wave * view.h * 0.035;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      var gradient = ctx.createLinearGradient(0, baseY - 120, 0, baseY + 180);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.4, band === 0 ? theme.auroraA + '2d' : theme.auroraB + '22');
      gradient.addColorStop(0.72, band === 0 ? theme.auroraB + '16' : theme.auroraA + '12');
      gradient.addColorStop(1, 'transparent');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 26 + band * 20;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStars() {
    ctx.save();
    for (var index = 0; index < stars.length; index += 1) {
      var star = stars[index];
      var twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.time * star.speed + star.phase));
      ctx.globalAlpha = twinkle * 0.75;
      ctx.fillStyle = '#e8fbff';
      ctx.fillRect((star.x / WORLD_W) * view.w, (star.y / WORLD_H) * view.h, star.size, star.size);
    }
    ctx.restore();
  }

  function drawMountains() {
    var theme = THEMES[state.roomIndex];
    var drift = (state.roomIndex * 17 + state.time * 0.7) % 100;
    var colors = [theme.mountainFar + 'dd', theme.mountainFar + 'cc', theme.mountainNear + 'f5'];
    for (var layer = 0; layer < mountains.length; layer += 1) {
      var points = mountains[layer];
      var offset = drift * (layer + 1) * 0.16;
      ctx.beginPath();
      ctx.moveTo(-120, view.h + 20);
      for (var index = 0; index < points.length; index += 1) {
        ctx.lineTo(points[index].x + offset, points[index].y);
      }
      ctx.lineTo(view.w + 120, view.h + 20);
      ctx.closePath();
      ctx.fillStyle = colors[layer];
      ctx.fill();
      if (layer === 2) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = theme.snow;
        ctx.beginPath();
        for (var pointIndex = 0; pointIndex < points.length; pointIndex += 2) {
          var point = points[pointIndex];
          ctx.moveTo(point.x + offset, point.y);
          ctx.lineTo(point.x + offset + 18, point.y + 24);
          ctx.lineTo(point.x + offset - 14, point.y + 20);
          ctx.closePath();
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawSnowLayer(flakes, front) {
    ctx.save();
    for (var index = 0; index < flakes.length; index += 1) {
      var flake = flakes[index];
      ctx.globalAlpha = flake.alpha * (front ? 0.8 : 1);
      ctx.fillStyle = front ? '#ecfdff' : '#c9edf5';
      var sway = Math.sin(state.time * 0.6 + flake.phase) * (front ? 2 : 5);
      ctx.beginPath();
      ctx.arc(flake.x + sway, flake.y, flake.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStageBackdrop() {
    var stage = view.stage;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 42;
    ctx.shadowOffsetY = 20;
    rr(stage.x, stage.y, stage.w, stage.h, 16);
    ctx.fillStyle = '#06111d';
    ctx.fill();
    ctx.restore();
  }

  function drawRoomBackground() {
    var theme = THEMES[state.roomIndex];
    var gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    gradient.addColorStop(0, theme.roomTop);
    gradient.addColorStop(0.55, theme.roomBottom);
    gradient.addColorStop(1, '#050d16');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    var glowY = 40 + state.time * 2;
    var doorGlow = ctx.createRadialGradient(240, glowY, 10, 240, glowY, 390);
    doorGlow.addColorStop(0, theme.accent + '22');
    doorGlow.addColorStop(0.42, theme.accent + '0b');
    doorGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = doorGlow;
    ctx.fillRect(0, 0, WORLD_W, 500);

    var moonX = state.roomIndex === 4 ? 354 : 112;
    var moonY = state.roomIndex === 4 ? 148 : 126;
    var moonRadius = state.roomIndex === 4 ? 44 : 26;
    var moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 4);
    moonGlow.addColorStop(0, theme.sun + '55');
    moonGlow.addColorStop(0.2, theme.sun + '1a');
    moonGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(0, 0, WORLD_W, 420);
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = theme.sun;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(moonX - 7, moonY - 5, moonRadius * 0.8, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.globalAlpha = 0.42;
    for (var layer = 0; layer < 3; layer += 1) {
      var yBase = 330 + layer * 58;
      ctx.beginPath();
      ctx.moveTo(-30, WORLD_H);
      for (var index = 0; index <= 12; index += 1) {
        var x = -30 + (index / 12) * (WORLD_W + 60);
        var ridge = Math.sin(index * 1.7 + layer * 2.5 + state.roomIndex) * (18 + layer * 10);
        var random = hash(index * 3.1 + layer * 12 + state.roomIndex) * 34;
        ctx.lineTo(x, yBase + ridge + random);
      }
      ctx.lineTo(WORLD_W + 30, WORLD_H);
      ctx.closePath();
      ctx.fillStyle = layer === 0 ? theme.mountainFar : (layer === 1 ? '#071522' : '#040b13');
      ctx.fill();
    }
    ctx.restore();

    var mist = ctx.createLinearGradient(0, 360, 0, 800);
    mist.addColorStop(0, 'transparent');
    mist.addColorStop(0.55, theme.haze + '0c');
    mist.addColorStop(1, theme.haze + '1a');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 330, WORLD_W, 470);

    for (var moteIndex = 0; moteIndex < motes.length; moteIndex += 1) {
      var mote = motes[moteIndex];
      ctx.globalAlpha = mote.alpha * (0.55 + 0.45 * Math.sin(state.time * 0.8 + mote.phase));
      ctx.fillStyle = theme.snow;
      ctx.fillRect(mote.x, mote.y, mote.size, mote.size);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    for (var line = 0; line < 7; line += 1) {
      var y = 80 + line * 105 + Math.sin(line * 2.2) * 14;
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(56 + hash(line) * 26, y - 70);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSolid(item) {
    if (item.hidden) return;
    var theme = THEMES[state.roomIndex];
    var isWall = item.h > 54;
    var isFloor = item.w > 400;
    var index;
    if (isFloor) {
      var floorGradient = ctx.createLinearGradient(0, item.y, 0, item.y + item.h);
      floorGradient.addColorStop(0, theme.rockLight);
      floorGradient.addColorStop(0.15, theme.rock);
      floorGradient.addColorStop(1, '#040b12');
      ctx.fillStyle = floorGradient;
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.fillStyle = theme.snow;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(item.x, item.y - 3, item.w, 4);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(item.x, item.y + 4, item.w, 1);
      ctx.globalAlpha = 1;
      for (index = 0; index < 18; index += 1) {
        var speckX = item.x + hash(index * 2.4) * item.w;
        var speckY = item.y + 9 + hash(index * 6.7) * (item.h - 12);
        ctx.globalAlpha = 0.12 + hash(index * 9.1) * 0.12;
        ctx.fillStyle = theme.snow;
        ctx.fillRect(speckX, speckY, 1 + hash(index * 4.3) * 2, 1);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (isWall) {
      var wallGradient = ctx.createLinearGradient(item.x, 0, item.x + item.w, 0);
      wallGradient.addColorStop(0, theme.rockLight);
      wallGradient.addColorStop(0.3, theme.rock);
      wallGradient.addColorStop(1, '#050d17');
      ctx.fillStyle = wallGradient;
      rr(item.x, item.y, item.w, item.h, 4);
      ctx.fill();
      if (item.edge === 'left' || item.edge === 'right') {
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = theme.snow;
        var edgeX = item.edge === 'left' ? item.x + item.w - 2 : item.x;
        ctx.fillRect(edgeX, item.y, 2, item.h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = theme.snow;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(item.x + 1, item.y, item.w - 2, 3);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1;
      for (index = 0; index < 3; index += 1) {
        var crackY = item.y + 20 + hash(index + item.x) * Math.max(20, item.h - 40);
        ctx.beginPath();
        ctx.moveTo(item.x + 4, crackY);
        ctx.lineTo(item.x + item.w - 4, crackY + 8 + Math.sin(index) * 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    var platformGradient = ctx.createLinearGradient(0, item.y, 0, item.y + item.h);
    platformGradient.addColorStop(0, theme.rockLight);
    platformGradient.addColorStop(0.28, theme.rock);
    platformGradient.addColorStop(1, '#050b13');
    ctx.fillStyle = platformGradient;
    rr(item.x, item.y, item.w, item.h, 3);
    ctx.fill();
    ctx.fillStyle = theme.snow;
    ctx.globalAlpha = 0.92;
    rr(item.x + 1, item.y - 2, item.w - 2, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(item.x + 2, item.y + 3, item.w - 4, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.rockLight;
    ctx.globalAlpha = 0.22;
    for (index = 0; index < Math.floor(item.w / 19); index += 1) {
      var grainX = item.x + 8 + index * 19 + hash(index + item.x) * 7;
      ctx.fillRect(grainX, item.y + 6, 1, item.h - 8);
    }
    ctx.globalAlpha = 1;
    if (item.h > 10 && item.w > 24) {
      ctx.fillStyle = theme.snow;
      ctx.globalAlpha = 0.4;
      var drips = Math.floor(item.w / 23);
      for (index = 0; index < drips; index += 1) {
        var dripX = item.x + 10 + index * 23 + hash(index * 2.3) * 8;
        var length = 1 + hash(index * 3.7) * 4;
        ctx.beginPath();
        ctx.moveTo(dripX, item.y + item.h);
        ctx.lineTo(dripX + 1.5, item.y + item.h + length);
        ctx.lineTo(dripX + 3, item.y + item.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawSpikes(item) {
    var theme = THEMES[state.roomIndex];
    var count = Math.max(1, Math.floor(item.w / 9));
    var spikeWidth = item.w / count;
    var gradient = ctx.createLinearGradient(0, item.y, 0, item.y + item.h);
    gradient.addColorStop(0, theme.snow);
    gradient.addColorStop(0.2, '#87c7d8');
    gradient.addColorStop(0.7, theme.rock);
    gradient.addColorStop(1, '#03080e');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    for (var index = 0; index < count; index += 1) {
      var x = item.x + index * spikeWidth;
      ctx.moveTo(x, item.y + item.h);
      ctx.lineTo(x + spikeWidth * 0.5, item.y);
      ctx.lineTo(x + spikeWidth, item.y + item.h);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = theme.snow;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (var shade = 0; shade < count; shade += 1) {
      var shadeX = item.x + shade * spikeWidth;
      ctx.moveTo(shadeX + spikeWidth * 0.5, item.y + 2);
      ctx.lineTo(shadeX + spikeWidth * 0.7, item.y + item.h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCrystal(item) {
    if (!item.active) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = THEMES[state.roomIndex].accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 10, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }
    var theme = THEMES[state.roomIndex];
    var pulse = 0.82 + Math.sin(state.time * 4 + item.phase) * 0.18;
    var glow = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, 30);
    glow.addColorStop(0, theme.accent + '55');
    glow.addColorStop(0.45, theme.accent + '1a');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(item.x - 32, item.y - 32, 64, 64);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.PI / 4 + Math.sin(state.time * 1.5 + item.phase) * 0.1);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#eafffb';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(-2, -5, 2, 10);
    ctx.restore();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(item.x - 1, item.y - 22 - Math.sin(state.time * 2 + item.phase) * 3, 2, 2);
    ctx.globalAlpha = 1;
  }

  function drawBerry(item) {
    if (!item.active) return;
    var bob = Math.sin(state.time * 2.4 + item.phase) * 3;
    var x = item.x;
    var y = item.y + bob;
    var glow = ctx.createRadialGradient(x, y, 0, x, y, 22);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.38)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 24, y - 24, 48, 48);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.time * 0.5 + item.phase);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    for (var index = 0; index < 10; index += 1) {
      var radius = index % 2 === 0 ? 7.5 : 3.2;
      var angle = (index / 10) * TAU - Math.PI / 2;
      var px = Math.cos(angle) * radius;
      var py = Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff5c7';
    ctx.beginPath();
    ctx.arc(-1.5, -1.5, 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawDoor() {
    var door = state.room.door;
    var theme = THEMES[state.roomIndex];
    var centerX = door.x + door.w / 2;
    var centerY = door.y + door.h / 2;
    var pulse = 0.8 + Math.sin(state.time * 2.2) * 0.2;
    var glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 100);
    glow.addColorStop(0, theme.accent + '45');
    glow.addColorStop(0.35, theme.accent + '16');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(centerX - 100, centerY - 100, 200, 200);

    ctx.save();
    ctx.translate(centerX, door.y + door.h);
    ctx.beginPath();
    ctx.moveTo(-door.w / 2, 0);
    ctx.lineTo(-door.w / 2, -door.h * 0.52);
    ctx.arc(0, -door.h * 0.52, door.w / 2, Math.PI, 0);
    ctx.lineTo(door.w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = '#061019';
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(-door.w / 2 + 6, 0);
    ctx.lineTo(-door.w / 2 + 6, -door.h * 0.52);
    ctx.arc(0, -door.h * 0.52, door.w / 2 - 6, Math.PI, 0);
    ctx.lineTo(door.w / 2 - 6, 0);
    ctx.closePath();
    var portal = ctx.createLinearGradient(0, -door.h, 0, 0);
    portal.addColorStop(0, theme.accent + '15');
    portal.addColorStop(0.55, theme.accent + '88');
    portal.addColorStop(1, '#ffffffaa');
    ctx.fillStyle = portal;
    ctx.fill();
    ctx.globalAlpha = 0.7;
    for (var index = 0; index < 3; index += 1) {
      var x = (hash(index * 4.2) - 0.5) * (door.w - 18);
      var y = -((state.time * (14 + index * 5) + index * 26) % (door.h - 12));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 6);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-door.w / 2 + 6, -1);
    ctx.lineTo(door.w / 2 - 6, -1);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = theme.snow;
    ctx.font = '700 7px "SFMono-Regular", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.roomIndex === LEVELS.length - 1 ? 'SUMMIT' : 'ASCEND', centerX, door.y - 12);
    ctx.restore();
  }

  function drawTrail() {
    for (var index = 0; index < trail.length; index += 1) {
      var echo = trail[index];
      var alpha = (echo.life / echo.maxLife) * 0.22;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = echo.grounded ? '#d9fbff' : '#ff9b71';
      rr(echo.x + 2, echo.y + 2, 10, 18, 4);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer(alpha, ghost) {
    var p = player;
    if (p.dead && !ghost) return;
    var feetX = p.x + p.w / 2;
    var feetY = p.y + p.h;
    var run = Math.sin(p.runCycle * 7);
    var running = Math.abs(p.vx) > 25 && p.grounded;
    var airborne = !p.grounded;
    var squash = p.squash;
    var breathe = Math.sin(state.time * 2.3) * 0.35;

    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.translate(feetX, feetY);
    ctx.scale(p.facing, 1);
    ctx.scale(1 / squash, squash);
    if (ghost) ctx.globalCompositeOperation = 'screen';
    if (p.wallSliding) ctx.rotate(p.wallDir * 0.08);

    var legSwing = running ? run * 3.2 : (airborne ? 1.8 : Math.sin(state.time * 2) * 0.45);
    ctx.strokeStyle = '#16233d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(-2 + legSwing, 1);
    ctx.moveTo(2, -5);
    ctx.lineTo(2 - legSwing, 1);
    ctx.stroke();
    ctx.strokeStyle = '#0a1424';
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(-2 + legSwing, 0);
    ctx.lineTo(-2 + legSwing + 2, 1);
    ctx.moveTo(2 - legSwing, 0);
    ctx.lineTo(2 - legSwing + 2, 1);
    ctx.stroke();

    var scarfLength = 8 + Math.min(12, Math.abs(p.vx) * 0.055);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-3, -15 + breathe);
    ctx.quadraticCurveTo(-8 - scarfLength * 0.35, -15 + Math.sin(state.time * 7) * 2.6, -7 - scarfLength, -14 + Math.sin(state.time * 5.4) * 4);
    ctx.stroke();
    ctx.strokeStyle = '#ff9b71';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3, -14 + breathe);
    ctx.quadraticCurveTo(-6 - scarfLength * 0.4, -12 + Math.cos(state.time * 6) * 2.7, -6 - scarfLength * 0.85, -9 + Math.sin(state.time * 5.2) * 3.4);
    ctx.stroke();

    var coat = ctx.createLinearGradient(0, -16, 0, -2);
    coat.addColorStop(0, '#ff8b82');
    coat.addColorStop(1, '#d84c68');
    ctx.fillStyle = coat;
    rr(-4.6, -14 + breathe, 9.2, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd3c5';
    rr(-4, -15 + breathe, 8, 3, 2);
    ctx.fill();

    ctx.fillStyle = '#1a2b49';
    rr(-3.6, -7 + breathe, 7.2, 4.5, 1.5);
    ctx.fill();

    ctx.fillStyle = '#f6d1bd';
    ctx.beginPath();
    ctx.arc(0.4, -18 + breathe, 4.7, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#ff5d73';
    ctx.beginPath();
    ctx.arc(-1.3, -20 + breathe, 4.7, Math.PI * 0.78, Math.PI * 2.05);
    ctx.lineTo(4.7, -16.2 + breathe);
    ctx.quadraticCurveTo(2.5, -18.7 + breathe, 1.4, -16.3 + breathe);
    ctx.quadraticCurveTo(-0.8, -18 + breathe, -3.5, -16.2 + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.2, -18.7 + breathe);
    ctx.quadraticCurveTo(7.2, -18.5 + breathe, 8.6, -14.2 + breathe);
    ctx.quadraticCurveTo(4.8, -15.5 + breathe, 2.9, -15.7 + breathe);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#17233d';
    ctx.beginPath();
    ctx.arc(2.8, -18 + breathe, 0.85, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3, -18.2 + breathe, 0.3, 0, TAU);
    ctx.fill();

    if (p.dashTimer > 0) {
      ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.8;
      ctx.strokeStyle = '#a8ffe9';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, -11, 12 + Math.sin(state.time * 24) * 2, 0, TAU);
      ctx.stroke();
    }
    if (p.wallSliding) {
      ctx.fillStyle = '#d9fbff';
      ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.6;
      ctx.fillRect(-10, -14, 2.4, 2.4);
      ctx.fillRect(7, -20, 2, 2);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (var index = 0; index < particles.length; index += 1) {
      var particle = particles[index];
      var alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle);
      ctx.fillStyle = particle.color;
      if (particle.shape === 'spark') {
        ctx.fillRect(-particle.size * 1.8, -0.6, particle.size * 3.6, 1.2);
      } else {
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      }
      ctx.restore();
    }
  }

  function drawRoomVignette() {
    var gradient = ctx.createRadialGradient(
      WORLD_W / 2, WORLD_H * 0.44, WORLD_W * 0.2,
      WORLD_W / 2, WORLD_H * 0.44, WORLD_W * 0.82
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.72, 'rgba(1, 5, 10, 0.06)');
    gradient.addColorStop(1, 'rgba(1, 5, 10, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    var topFade = ctx.createLinearGradient(0, 0, 0, 90);
    topFade.addColorStop(0, 'rgba(2, 8, 14, 0.24)');
    topFade.addColorStop(1, 'transparent');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, WORLD_W, 90);
  }

  function drawStageFrame() {
    var stage = view.stage;
    ctx.save();
    rr(stage.x, stage.y, stage.w, stage.h, 16);
    ctx.strokeStyle = 'rgba(196, 244, 255, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    rr(stage.x + 2, stage.y + 2, stage.w - 4, stage.h - 4, 14);
    ctx.strokeStyle = 'rgba(196, 244, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawFlash() {
    if (state.flash > 0) {
      ctx.fillStyle = 'rgba(215, 255, 248, ' + (state.flash * 0.22) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (state.deathFlash > 0) {
      var gradient = ctx.createRadialGradient(view.w / 2, view.h / 2, view.w * 0.12, view.w / 2, view.h / 2, view.w * 0.8);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, 'rgba(255, 65, 82, ' + (state.deathFlash * 0.34) + ')');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  function drawTransition() {
    var alpha = 0;
    if (state.mode === 'transition') {
      if (state.transition < 0.52) alpha = smooth(state.transition / 0.52);
      else alpha = 1 - smooth((state.transition - 0.54) / 0.7);
    }
    alpha = clamp(alpha, 0, 1);
    if (alpha <= 0) return;
    ctx.fillStyle = 'rgba(2, 8, 14, ' + alpha + ')';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.globalAlpha = Math.sin(alpha * Math.PI) * 0.8;
    var stage = view.stage;
    var gradient = ctx.createLinearGradient(stage.x, stage.y, stage.x + stage.w, stage.y + stage.h);
    gradient.addColorStop(0, 'rgba(91, 228, 197, 0)');
    gradient.addColorStop(0.5, '#c9fff1');
    gradient.addColorStop(1, 'rgba(255, 155, 113, 0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(stage.x, stage.y + stage.h * 0.68);
    ctx.lineTo(stage.x + stage.w, stage.y + stage.h * 0.32);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    drawSky();
    drawSnowLayer(snowBack, false);
    drawAurora();
    drawStars();
    drawMountains();
    drawStageBackdrop();

    var stage = view.stage;
    ctx.save();
    rr(stage.x, stage.y, stage.w, stage.h, 16);
    ctx.clip();
    ctx.translate(stage.x, stage.y);
    ctx.scale(stage.scale, stage.scale);

    drawRoomBackground();
    ctx.save();
    if (state.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawDoor();
    for (var index = 0; index < state.room.solids.length; index += 1) drawSolid(state.room.solids[index]);
    for (index = 0; index < state.room.spikes.length; index += 1) drawSpikes(state.room.spikes[index]);
    for (index = 0; index < state.room.crystals.length; index += 1) drawCrystal(state.room.crystals[index]);
    for (index = 0; index < state.room.berries.length; index += 1) drawBerry(state.room.berries[index]);
    drawTrail();
    drawPlayer(1, false);
    drawParticles();
    drawRoomVignette();
    ctx.restore();
    ctx.restore();

    drawStageFrame();
    drawSnowLayer(snowFront, true);
    drawFlash();
    drawTransition();
  }

  function setJoystick(clientX, clientY) {
    var rect = ui.joystick.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var radius = rect.width * 0.3;
    var dx = clientX - centerX;
    var dy = clientY - centerY;
    var distance = Math.hypot(dx, dy);
    var limit = radius;
    if (distance > limit) {
      dx = (dx / distance) * limit;
      dy = (dy / distance) * limit;
    }
    joy.x = clamp(dx / radius, -1, 1);
    joy.y = clamp(dy / radius, -1, 1);
    if (Math.hypot(joy.x, joy.y) < 0.16) {
      joy.x = 0;
      joy.y = 0;
    }
    ui.stick.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
  }

  function resetJoystick() {
    joy.x = 0;
    joy.y = 0;
    joy.active = false;
    joy.pointer = null;
    ui.stick.style.transform = 'translate(0px, 0px)';
  }

  function bindHold(element, name) {
    var pointers = new Set();
    function release(event) {
      if (event && pointers.has(event.pointerId)) pointers.delete(event.pointerId);
      else if (!event) pointers.clear();
      if (pointers.size === 0) {
        held[name] = false;
        element.classList.remove('held');
      }
    }
    element.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      ensureAudio();
      pointers.add(event.pointerId);
      held[name] = true;
      pressed[name] = true;
      element.classList.add('held');
      try { element.setPointerCapture(event.pointerId); } catch (error) {}
    });
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  function updateTiltUI() {
    ui.tilt.setAttribute('aria-pressed', tiltEnabled ? 'true' : 'false');
    ui.tiltTitle.setAttribute('aria-pressed', tiltEnabled ? 'true' : 'false');
    var titleLabel = ui.tiltTitle.querySelector('span');
    if (titleLabel) titleLabel.textContent = 'MOTION TILT: ' + (tiltEnabled ? 'ON' : 'OFF');
    ui.tilt.title = tiltEnabled ? 'Motion tilt steering on' : 'Enable motion tilt steering';
  }

  function handleTilt(event) {
    var angle = 0;
    if (screen.orientation && typeof screen.orientation.angle === 'number') angle = screen.orientation.angle;
    else if (typeof window.orientation === 'number') angle = window.orientation;
    var raw = event.gamma;
    if (Math.abs(angle) === 90) {
      raw = angle === 90 ? -event.beta : event.beta;
    }
    if (raw === null || raw === undefined || Number.isNaN(raw)) return;
    if (tiltCenter === null) tiltCenter = raw;
    var delta = raw - tiltCenter;
    tiltTarget = clamp(delta / 22, -1, 1);
  }

  function toggleTilt() {
    if (tiltEnabled) {
      tiltEnabled = false;
      tiltTarget = 0;
      tiltValue = 0;
      window.removeEventListener('deviceorientation', handleTilt);
      updateTiltUI();
      showToast('MOTION TILT OFF');
      return;
    }
    if (!tiltSupported) {
      showToast('MOTION TILT IS NOT AVAILABLE');
      return;
    }
    var permission = null;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      permission = DeviceOrientationEvent.requestPermission();
    } else if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      permission = DeviceMotionEvent.requestPermission();
    }
    var enable = function () {
      tiltCenter = null;
      tiltTarget = 0;
      tiltValue = 0;
      window.addEventListener('deviceorientation', handleTilt);
      tiltEnabled = true;
      ui.tilt.classList.remove('is-denied');
      ui.tiltTitle.classList.remove('is-denied');
      updateTiltUI();
      showToast('TILT STEERING ON', 2.4);
    };
    if (permission && typeof permission.then === 'function') {
      permission.then(function (result) {
        if (result === 'granted') enable();
        else {
          ui.tilt.classList.add('is-denied');
          ui.tiltTitle.classList.add('is-denied');
          showToast('MOTION ACCESS DENIED', 2.6);
        }
      }).catch(function () {
        ui.tilt.classList.add('is-denied');
        ui.tiltTitle.classList.add('is-denied');
        showToast('MOTION ACCESS DENIED', 2.6);
      });
    } else {
      enable();
    }
  }

  function toggleSound() {
    muted = !muted;
    ui.sound.setAttribute('aria-pressed', muted ? 'false' : 'true');
    if (!muted) {
      ensureAudio();
      sfx.tick();
    }
  }

  function bindControls() {
    ui.joystick.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      ensureAudio();
      joy.active = true;
      joy.pointer = event.pointerId;
      try { ui.joystick.setPointerCapture(event.pointerId); } catch (error) {}
      setJoystick(event.clientX, event.clientY);
    });
    ui.joystick.addEventListener('pointermove', function (event) {
      if (!joy.active || joy.pointer !== event.pointerId) return;
      event.preventDefault();
      setJoystick(event.clientX, event.clientY);
    });
    var endJoy = function (event) {
      if (joy.pointer === event.pointerId) resetJoystick();
    };
    ui.joystick.addEventListener('pointerup', endJoy);
    ui.joystick.addEventListener('pointercancel', endJoy);
    ui.joystick.addEventListener('lostpointercapture', endJoy);

    bindHold(ui.jump, 'jump');
    bindHold(ui.dash, 'dash');

    window.addEventListener('keydown', function (event) {
      var code = event.code;
      var gameplay = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyZ', 'KeyX', 'KeyR', 'KeyP', 'KeyM', 'Escape'];
      if (gameplay.indexOf(code) !== -1) event.preventDefault();
      if (event.repeat) return;
      keys.add(code);
      if (code === 'Space' || code === 'KeyZ' || code === 'ArrowUp') pressed.jump = true;
      if (code === 'KeyX' || code === 'ShiftLeft' || code === 'ShiftRight') pressed.dash = true;
      if (code === 'Enter' || code === 'Space') {
        if (state.mode === 'title') startGame();
        else if (state.mode === 'won' && code === 'Enter') restartRun();
      }
      if (code === 'KeyP' || code === 'Escape') {
        if (state.mode === 'playing') pauseGame();
        else if (state.mode === 'paused') resumeGame();
      }
      if (code === 'KeyR') restartRoom();
      if (code === 'KeyM') toggleSound();
    });
    window.addEventListener('keyup', function (event) {
      keys.delete(event.code);
    });

    window.addEventListener('blur', function () {
      keys.clear();
      held.jump = false;
      held.dash = false;
      resetJoystick();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.mode === 'playing') pauseGame();
    });

    ui.start.addEventListener('click', startGame);
    ui.resume.addEventListener('click', resumeGame);
    ui.restart.addEventListener('click', restartRoom);
    ui.again.addEventListener('click', restartRun);
    ui.tilt.addEventListener('click', toggleTilt);
    ui.tiltTitle.addEventListener('click', toggleTilt);
    ui.sound.addEventListener('click', toggleSound);
    window.addEventListener('resize', function () {
      resize();
      buildAmbient();
    });
    window.addEventListener('contextmenu', function (event) {
      if (event.target === canvas || event.target.closest('.touch-controls')) event.preventDefault();
    });
  }

  var lastFrame = performance.now();
  function frame(now) {
    var rawDt = Math.max(0.001, (now - lastFrame) / 1000);
    var dt = Math.min(rawDt, 1 / 30);
    lastFrame = now;
    if (state.mode === 'playing' && document.visibilityState === 'visible') {
      qualityElapsed += rawDt;
      qualityFrames += 1;
      if (qualityElapsed > 1.6) {
        var fps = qualityFrames / qualityElapsed;
        if (fps < 34 && quality > 0.62) {
          quality = Math.max(0.62, quality - 0.16);
          resize();
        } else if (fps > 54 && quality < 1) {
          quality = Math.min(1, quality + 0.1);
          resize();
        }
        qualityElapsed = 0;
        qualityFrames = 0;
      }
    }
    update(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  if (window.location.search.indexOf('debug') !== -1) {
    window.__AURORA_DEBUG__ = {
      state: state,
      player: player,
      levels: LEVELS,
      startGame: startGame,
      loadRoom: loadRoom,
      reachDoor: reachDoor,
      respawn: respawn,
      update: update,
      pressed: pressed,
      held: held,
      keys: keys,
      input: input
    };
  }

  resize();
  buildAmbient();
  loadRoom(0, false);
  updateBerries();
  updateTiltUI();
  if (!tiltSupported) {
    ui.tilt.classList.add('is-denied');
    ui.tiltTitle.classList.add('is-denied');
  }
  bindControls();
  window.requestAnimationFrame(frame);
}());
