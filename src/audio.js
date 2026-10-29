class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
  }

  init() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.48;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer(2.5);
      this.startWind();
    } catch {
      this.context = null;
    }
  }

  createNoiseBuffer(seconds) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.4;
    }
    return buffer;
  }

  startWind() {
    if (!this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 360;
    const gain = this.context.createGain();
    gain.gain.value = 0.035;
    const lfo = this.context.createOscillator();
    lfo.frequency.value = 0.075;
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 0.014;
    lfo.connect(lfoGain).connect(gain.gain);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    lfo.start();
  }

  get now() {
    return this.context ? this.context.currentTime : 0;
  }

  tone(frequency, duration, options = {}) {
    if (!this.context || this.muted) return;
    const {
      type = 'sine',
      gain = 0.08,
      endFrequency = null,
      attack = 0.004,
      delay = 0,
    } = options;
    const start = this.now + delay;
    const oscillator = this.context.createOscillator();
    const amp = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(amp).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise(duration, options = {}) {
    if (!this.context || this.muted) return;
    const {
      gain = 0.1,
      filterType = 'lowpass',
      frequency = 900,
      endFrequency = null,
      delay = 0,
      q = 0.6,
    } = options;
    const start = this.now + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, start);
    if (endFrequency) filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), start + duration);
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  shoot(weapon = 'pistol') {
    if (!this.context || this.muted) return;
    if (weapon === 'rifle') {
      this.noise(0.34, { gain: 0.72, frequency: 2500, endFrequency: 110, filterType: 'lowpass' });
      this.tone(118, 0.28, { type: 'triangle', gain: 0.38, endFrequency: 38 });
      this.noise(0.1, { gain: 0.22, filterType: 'highpass', frequency: 2100, delay: 0.02 });
    } else {
      this.noise(0.19, { gain: 0.5, frequency: 1900, endFrequency: 180, filterType: 'lowpass' });
      this.tone(145, 0.16, { type: 'square', gain: 0.17, endFrequency: 48 });
    }
  }

  empty() {
    this.tone(1800, 0.035, { type: 'square', gain: 0.035, endFrequency: 800 });
  }

  reload() {
    this.tone(720, 0.04, { type: 'square', gain: 0.035, delay: 0.06 });
    this.tone(480, 0.05, { type: 'square', gain: 0.035, delay: 0.42 });
    this.noise(0.035, { gain: 0.04, filterType: 'highpass', frequency: 1800, delay: 0.85 });
  }

  footstep(sprint = false) {
    if (!this.context || this.muted) return;
    this.noise(0.09, {
      gain: sprint ? 0.045 : 0.027,
      filterType: 'lowpass',
      frequency: sprint ? 450 : 320,
    });
  }

  pickup() {
    this.tone(620, 0.11, { type: 'triangle', gain: 0.06 });
    this.tone(930, 0.16, { type: 'triangle', gain: 0.045, delay: 0.07 });
  }

  heal() {
    this.tone(420, 0.3, { type: 'sine', gain: 0.05 });
    this.tone(630, 0.35, { type: 'sine', gain: 0.04, delay: 0.08 });
    this.tone(840, 0.4, { type: 'sine', gain: 0.028, delay: 0.16 });
  }

  hurt() {
    this.noise(0.2, { gain: 0.17, filterType: 'lowpass', frequency: 260 });
    this.tone(82, 0.3, { type: 'sawtooth', gain: 0.07, endFrequency: 42 });
  }

  hit() {
    this.noise(0.06, { gain: 0.07, filterType: 'bandpass', frequency: 780, q: 1.4 });
    this.tone(175, 0.07, { type: 'triangle', gain: 0.055, endFrequency: 80 });
  }

  growl() {
    if (!this.context || this.muted) return;
    this.tone(58, 0.75, { type: 'sawtooth', gain: 0.055, endFrequency: 38, attack: 0.08 });
    this.noise(0.7, { gain: 0.035, filterType: 'bandpass', frequency: 170, q: 2.1 });
  }

  heartbeat() {
    this.tone(52, 0.13, { type: 'sine', gain: 0.16, endFrequency: 34 });
    this.tone(45, 0.15, { type: 'sine', gain: 0.11, endFrequency: 30, delay: 0.19 });
  }

  win() {
    const notes = [262, 330, 392, 523];
    notes.forEach((note, index) => this.tone(note, 0.7, { type: 'triangle', gain: 0.06, delay: index * 0.16 }));
  }

  lose() {
    this.tone(110, 1.2, { type: 'sawtooth', gain: 0.08, endFrequency: 42 });
    this.noise(1.1, { gain: 0.08, filterType: 'lowpass', frequency: 220 });
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.48;
    return this.muted;
  }
}

export const audio = new GameAudio();
