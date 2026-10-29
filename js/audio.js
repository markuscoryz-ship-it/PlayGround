export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
    this.volume = 0.62;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.sirenGain = null;
    this.sirenOsc = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.nextPluck = 0;
    this.chordIndex = 0;
    this.nextChord = 0;
    this.noise = null;
    this.padOscs = [];
    this.pluckIndex = 0;
    this.lastGun = 0;
  }

  start() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.started = true;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.2;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.noise = this.makeNoise(1.2);
    this.buildEngine();
    this.buildSiren();
    this.buildPad();
    this.startMusic();
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 3;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 46;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 23;
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    this.engineOsc2.connect(g2);
    g2.connect(this.engineFilter);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  buildSiren() {
    const ctx = this.ctx;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenGain.connect(this.sfxGain);
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 2;
    this.sirenOsc.connect(filter);
    filter.connect(this.sirenGain);
    this.sirenOsc.start();
  }

  buildPad() {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    filter.connect(gain);
    gain.connect(this.musicGain);
    this.padFilter = filter;
    this.padNotes = [
      [110, 138.59, 164.81, 220],
      [98, 130.81, 155.56, 196],
      [87.31, 110, 130.81, 174.61],
      [82.41, 103.83, 123.47, 164.81]
    ];
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = this.padNotes[0][i];
      osc.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.16 : 0.12;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      this.padOscs.push(osc);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  }

  startMusic() {
    const delay = this.ctx.createDelay();
    delay.delayTime.value = 0.36;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.32;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.22;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.musicGain);
    this.pluckDelay = delay;
    this.nextPluck = this.ctx.currentTime + 0.6;
    this.nextChord = this.ctx.currentTime + 8;
  }

  pluck(time, freq, dur = 0.5, volume = 0.12) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    if (this.pluckDelay) gain.connect(this.pluckDelay);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  update(dt, params) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    const speed = params.speed || 0;
    const driving = !!params.driving;
    const wanted = params.wanted || 0;
    const targetEngine = driving ? Math.min(0.19, 0.045 + Math.abs(speed) * 0.006) : 0;
    this.engineGain.gain.setTargetAtTime(targetEngine, now, 0.08);
    if (this.engineOsc) {
      const base = 42 + Math.min(130, Math.abs(speed) * 4.2);
      this.engineOsc.frequency.setTargetAtTime(base, now, 0.1);
      this.engineOsc2.frequency.setTargetAtTime(base * 0.5, now, 0.1);
      this.engineFilter.frequency.setTargetAtTime(300 + Math.abs(speed) * 26, now, 0.1);
    }
    if (this.sirenOsc) {
      const target = wanted > 0 ? 0.035 : 0;
      this.sirenGain.gain.setTargetAtTime(target, now, 0.2);
      if (wanted > 0) {
        const t = now * 1.6;
        const f = 640 + (Math.sin(t) * 0.5 + 0.5) * 380;
        this.sirenOsc.frequency.setTargetAtTime(f, now, 0.08);
      }
    }
    if (this.padOscs.length && now > this.nextChord) {
      this.nextChord = now + 8;
      this.chordIndex = (this.chordIndex + 1) % this.padNotes.length;
      const notes = this.padNotes[this.chordIndex];
      this.padOscs.forEach((osc, i) => osc.frequency.setTargetAtTime(notes[i], now, 1.8));
    }
    if (now > this.nextPluck) {
      const notes = [440, 523.25, 659.25, 783.99, 523.25, 659.25, 880, 659.25];
      this.pluck(now, notes[this.pluckIndex % notes.length], 0.55, 0.055);
      this.pluckIndex++;
      this.nextPluck = now + (this.pluckIndex % 8 === 0 ? 1.6 : 0.46);
    }
  }

  gunshot() {
    if (!this.started) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (now - this.lastGun < 0.04) return;
    this.lastGun = now;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1300;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.2);
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
    og.gain.setValueAtTime(0.35, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(og);
    og.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  crash(intensity = 1) {
    if (!this.started) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.4);
  }

  explosion() {
    if (!this.started) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 1.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 1.3);
  }

  blip(freq = 880, duration = 0.12, type = 'sine', volume = 0.12) {
    if (!this.started) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  pickup() {
    this.blip(740, 0.1, 'sine', 0.1);
    setTimeout(() => this.blip(1108, 0.16, 'sine', 0.09), 70);
  }

  mission() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.28, 'triangle', 0.08), i * 95));
  }

  wanted() {
    this.blip(220, 0.25, 'square', 0.06);
    setTimeout(() => this.blip(196, 0.3, 'square', 0.05), 140);
  }

  horn() {
    if (!this.started) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (const f of [330, 415]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}
