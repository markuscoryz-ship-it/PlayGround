import { clamp, state, touchUi } from './config.js';
import { ui } from './dom.js';
import { hideAimHint, showAimHint } from './hud.js';

export const input = {
  keys: new Set(),
};

let handlers = {};
let lookPointer = null;
let joystickPointer = null;
let joystickRadius = 1;
let mouseDragging = false;

function requestPointerLock() {
  if (touchUi) return;
  try {
    const request = ui.canvas.requestPointerLock?.();
    if (request?.catch) request.catch(() => {});
  } catch {
    // Pointer lock is optional; touch and keyboard movement still work.
  }
}

function applyLook(dx, dy, sensitivity) {
  state.yaw -= dx * sensitivity;
  state.pitch = clamp(state.pitch - dy * sensitivity * 0.82, -0.27, 0.54);
  if (state.yaw > Math.PI * 2) state.yaw -= Math.PI * 2;
  if (state.yaw < 0) state.yaw += Math.PI * 2;
}

function setFire(held) {
  if (!state.started || state.paused || state.ended) {
    state.fireHeld = false;
    return;
  }
  state.fireHeld = held;
  if (held) handlers.onFire?.();
}

function setSprint(held) {
  state.sprintHeld = held;
  ui.sprintBtn.classList.toggle('active', held);
}

function updateJoystick(event) {
  const rect = ui.joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  joystickRadius = rect.width * 0.33;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > joystickRadius) {
    dx = (dx / distance) * joystickRadius;
    dy = (dy / distance) * joystickRadius;
  }
  state.joyX = dx / joystickRadius;
  state.joyY = dy / joystickRadius;
  if (Math.abs(state.joyX) < 0.08) state.joyX = 0;
  if (Math.abs(state.joyY) < 0.08) state.joyY = 0;
  ui.joystickKnob.style.transform = `translate(${dx * 0.58}px, ${dy * 0.58}px)`;
}

function releaseJoystick() {
  joystickPointer = null;
  state.joyX = 0;
  state.joyY = 0;
  ui.joystickKnob.style.transform = 'translate(0px, 0px)';
}

export function releaseInput() {
  input.keys.clear();
  state.fireHeld = false;
  setSprint(false);
  releaseJoystick();
  lookPointer = null;
  mouseDragging = false;
}

export function setupInput(callbacks) {
  handlers = callbacks;

  ui.play.addEventListener('click', () => handlers.onStart?.());
  ui.pauseBtn.addEventListener('click', () => handlers.onPause?.());
  ui.resumeBtn.addEventListener('click', () => handlers.onResume?.());
  ui.restartBtn.addEventListener('click', () => window.location.reload());
  ui.retryBtn.addEventListener('click', () => window.location.reload());
  ui.soundBtn.addEventListener('click', () => handlers.onSound?.());
  ui.reloadBtn.addEventListener('click', () => handlers.onReload?.());
  ui.interactBtn.addEventListener('click', () => handlers.onInteract?.());

  for (const slot of ui.slots) {
    slot.addEventListener('click', () => handlers.onUse?.(slot.dataset.use));
  }

  const fireDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    ui.fireBtn.setPointerCapture?.(event.pointerId);
    setFire(true);
  };
  const fireUp = (event) => {
    event.preventDefault();
    setFire(false);
  };
  ui.fireBtn.addEventListener('pointerdown', fireDown);
  ui.fireBtn.addEventListener('pointerup', fireUp);
  ui.fireBtn.addEventListener('pointercancel', fireUp);
  ui.fireBtn.addEventListener('lostpointercapture', fireUp);

  const sprintDown = (event) => {
    event.preventDefault();
    ui.sprintBtn.setPointerCapture?.(event.pointerId);
    setSprint(true);
  };
  const sprintUp = (event) => {
    event.preventDefault();
    setSprint(false);
  };
  ui.sprintBtn.addEventListener('pointerdown', sprintDown);
  ui.sprintBtn.addEventListener('pointerup', sprintUp);
  ui.sprintBtn.addEventListener('pointercancel', sprintUp);
  ui.sprintBtn.addEventListener('lostpointercapture', sprintUp);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.preventDefault();
    if (!state.started) return;
    if (event.code === 'Escape') {
      if (!state.ended) handlers.onPause?.();
      return;
    }
    if (state.paused || state.ended) return;

    input.keys.add(event.code);
    if (event.repeat) return;

    if (event.code === 'KeyE') handlers.onInteract?.();
    if (event.code === 'KeyR') handlers.onReload?.();
    if (event.code === 'Digit1') handlers.onUse?.('food');
    if (event.code === 'Digit2') handlers.onUse?.('water');
    if (event.code === 'Digit3') handlers.onUse?.('med');
    if (event.code === 'KeyM') handlers.onSound?.();
    if (event.code === 'Space') setFire(true);
  });

  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
    if (event.code === 'Space') setFire(false);
  });

  window.addEventListener('blur', releaseInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handlers.onHidden?.();
  });

  ui.canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || touchUi || !state.started || state.paused || state.ended) return;
    if (document.pointerLockElement !== ui.canvas) {
      requestPointerLock();
      return;
    }
    setFire(true);
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) setFire(false);
    mouseDragging = false;
  });

  document.addEventListener('mousemove', (event) => {
    if (touchUi || !state.started || state.paused) return;
    if (document.pointerLockElement === ui.canvas) {
      applyLook(event.movementX || 0, event.movementY || 0, 0.00215);
    } else if (mouseDragging) {
      applyLook(event.movementX || 0, event.movementY || 0, 0.0024);
    }
  });

  ui.canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0 && !touchUi) mouseDragging = true;
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === ui.canvas) hideAimHint();
    else if (state.started && !state.paused && !state.ended && !touchUi) showAimHint();
  });

  ui.canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || !state.started || state.paused || state.ended) return;
    event.preventDefault();
    lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    ui.canvas.setPointerCapture?.(event.pointerId);
  });

  ui.canvas.addEventListener('pointermove', (event) => {
    if (!lookPointer || event.pointerId !== lookPointer.id || !state.started || state.paused) return;
    event.preventDefault();
    const dx = event.clientX - lookPointer.x;
    const dy = event.clientY - lookPointer.y;
    lookPointer.x = event.clientX;
    lookPointer.y = event.clientY;
    applyLook(dx, dy, 0.0043);
  });

  const endLook = (event) => {
    if (lookPointer && event.pointerId === lookPointer.id) lookPointer = null;
  };
  ui.canvas.addEventListener('pointerup', endLook);
  ui.canvas.addEventListener('pointercancel', endLook);

  ui.joystick.addEventListener('pointerdown', (event) => {
    if (!state.started || state.paused || state.ended) return;
    event.preventDefault();
    joystickPointer = event.pointerId;
    ui.joystick.setPointerCapture?.(event.pointerId);
    updateJoystick(event);
  });
  ui.joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== joystickPointer) return;
    event.preventDefault();
    updateJoystick(event);
  });
  ui.joystick.addEventListener('pointerup', (event) => {
    if (event.pointerId === joystickPointer) releaseJoystick();
  });
  ui.joystick.addEventListener('pointercancel', releaseJoystick);
  ui.joystick.addEventListener('lostpointercapture', releaseJoystick);

  ui.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return input;
}

export function isMoving() {
  return (
    state.joyX !== 0 ||
    state.joyY !== 0 ||
    input.keys.has('KeyW') ||
    input.keys.has('KeyA') ||
    input.keys.has('KeyS') ||
    input.keys.has('KeyD') ||
    input.keys.has('ArrowUp') ||
    input.keys.has('ArrowDown') ||
    input.keys.has('ArrowLeft') ||
    input.keys.has('ArrowRight')
  );
}

export function getMovement() {
  let forward = 0;
  let strafe = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) forward += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) forward -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) strafe += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) strafe -= 1;
  forward -= state.joyY;
  strafe += state.joyX;

  const length = Math.hypot(forward, strafe);
  if (length > 1) {
    forward /= length;
    strafe /= length;
  }
  return { forward, strafe, moving: length > 0.06 };
}

export function sprintHeld() {
  return (
    state.sprintHeld ||
    input.keys.has('ShiftLeft') ||
    input.keys.has('ShiftRight')
  );
}
