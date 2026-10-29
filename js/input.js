import { clamp, damp } from './utils.js';

export class Input {
  constructor(canvas, elements, callbacks = {}) {
    this.canvas = canvas;
    this.el = elements;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.moveX = 0;
    this.moveY = 0;
    this.sprint = false;
    this.fire = false;
    this.brake = false;
    this.fireHeld = false;
    this.sprintHeld = false;
    this.brakeHeld = false;
    this.actionHeld = false;
    this.jumpHeld = false;
    this.actionQueued = false;
    this.jumpQueued = false;
    this.cameraDX = 0;
    this.cameraDY = 0;
    this.dragging = false;
    this.dragId = null;
    this.lastDragX = 0;
    this.lastDragY = 0;
    this.lastLookTime = 0;
    this.joystick = { x: 0, y: 0, active: false, id: null };
    this.tiltEnabled = false;
    this.tiltSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    this.tiltValue = 0;
    this.tiltRaw = 0;
    this.tiltBaseline = null;
    this.tiltListener = null;
    this.sensitivity = 1;

    this.setupKeyboard();
    this.setupJoystick();
    this.setupCamera();
    this.setupButtons();
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'e', 'f', 'escape'].includes(k)) {
        if (k !== 'escape') e.preventDefault();
      }
      if (k === 'escape') {
        this.callbacks.onPause?.();
        return;
      }
      if (this.keys.has(k)) return;
      this.keys.add(k);
      if (k === 'e' || k === 'enter') this.actionQueued = true;
      if (k === ' ') this.jumpQueued = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.fire = false;
      this.sprint = false;
      this.brake = false;
    });
  }

  setupJoystick() {
    const zone = this.el.stickZone;
    const base = this.el.stickBase;
    const knob = this.el.stickKnob;
    if (!zone) return;
    const MAX = 51;
    const updateFromEvent = (e) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > MAX) { dx = (dx / len) * MAX; dy = (dy / len) * MAX; }
      this.joystick.x = dx / MAX;
      this.joystick.y = -dy / MAX;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (this.joystick.active) return;
      e.preventDefault();
      this.joystick.active = true;
      this.joystick.id = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      updateFromEvent(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (!this.joystick.active || e.pointerId !== this.joystick.id) return;
      e.preventDefault();
      updateFromEvent(e);
    });
    const release = (e) => {
      if (e.pointerId !== this.joystick.id) return;
      this.joystick.active = false;
      this.joystick.id = null;
      this.joystick.x = 0;
      this.joystick.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
  }

  setupCamera() {
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.dragging = true;
      this.dragId = e.pointerId;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerId !== this.dragId) return;
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.cameraDX += dx;
      this.cameraDY += dy;
      this.lastLookTime = performance.now();
    });
    const end = (e) => {
      if (e.pointerId !== this.dragId) return;
      this.dragging = false;
      this.dragId = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setupButtons() {
    const hold = (el, name) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('pressed');
        if (name === 'fire') this.fireHeld = true;
        else if (name === 'sprint') this.sprintHeld = true;
        else if (name === 'brake') this.brakeHeld = true;
        if (name === 'actionHeld') { this.actionQueued = true; this.actionHeld = true; }
        try { el.setPointerCapture(e.pointerId); } catch {}
      });
      const release = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('pressed');
        if (name === 'actionHeld') this.actionHeld = false;
        else if (name === 'fire') this.fireHeld = false;
        else if (name === 'sprint') this.sprintHeld = false;
        else if (name === 'brake') this.brakeHeld = false;
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', (e) => {
        if (e.buttons === 0) release(e);
      });
    };
    hold(this.el.btnFire, 'fire');
    hold(this.el.btnSprint, 'sprint');
    hold(this.el.btnBrake, 'brake');
    hold(this.el.btnAction, 'actionHeld');
  }

  consumeAction() {
    const v = this.actionQueued;
    this.actionQueued = false;
    return v;
  }

  consumeJump() {
    const v = this.jumpQueued;
    this.jumpQueued = false;
    return v;
  }

  get jump() {
    return this.keys.has(' ');
  }

  update(dt) {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    const keyLen = Math.hypot(x, y);
    if (keyLen > 1) { x /= keyLen; y /= keyLen; }
    if (this.joystick.active) {
      x = this.joystick.x;
      y = this.joystick.y;
    }
    this.moveX = damp(this.moveX, x, 16, dt);
    this.moveY = damp(this.moveY, y, 16, dt);
    this.sprint = this.sprintHeld || k.has('shift');
    this.brake = this.brakeHeld || k.has(' ');
    this.fire = this.fireHeld || k.has('f');

    if (this.tiltEnabled) {
      if (this.tiltBaseline === null) this.tiltBaseline = this.tiltRaw;
      let v = (this.tiltRaw - this.tiltBaseline) / (24 * this.sensitivity);
      v = clamp(v, -1, 1);
      if (Math.abs(v) < 0.08) v = 0;
      this.tiltValue = damp(this.tiltValue, v, 9, dt);
    } else {
      this.tiltValue = damp(this.tiltValue, 0, 9, dt);
    }

  }

  consumeCamera() {
    const dx = this.cameraDX;
    const dy = this.cameraDY;
    this.cameraDX = 0;
    this.cameraDY = 0;
    return { dx, dy };
  }

  async enableTilt() {
    if (this.tiltEnabled) return true;
    if (!this.tiltSupported) return false;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') return false;
      }
      this.tiltListener = (e) => {
        const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        let raw;
        if (angle === 90 || angle === -90 || angle === 270) raw = e.beta;
        else raw = e.gamma;
        if (raw === null || raw === undefined) return;
        if (angle === -90 || angle === 270) raw = -raw;
        this.tiltRaw = raw;
        if (this.tiltBaseline === null) this.tiltBaseline = raw;
      };
      window.addEventListener('deviceorientation', this.tiltListener, true);
      this.tiltEnabled = true;
      this.tiltBaseline = null;
      return true;
    } catch (err) {
      console.warn('Motion permission failed', err);
      return false;
    }
  }

  disableTilt() {
    if (this.tiltListener) window.removeEventListener('deviceorientation', this.tiltListener, true);
    this.tiltListener = null;
    this.tiltEnabled = false;
    this.tiltValue = 0;
    this.tiltBaseline = null;
  }

  async toggleTilt() {
    if (this.tiltEnabled) { this.disableTilt(); return false; }
    return this.enableTilt();
  }
}
