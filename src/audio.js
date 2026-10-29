export class AudioFX {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.engine = null
    this.engineGain = null
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return false
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.62
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return true
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.04)
  }

  tone(freq, duration = 0.12, type = 'sine', volume = 0.08, slideTo = null) {
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain).connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.03)
  }

  click() {
    this.tone(520, 0.06, 'triangle', 0.05, 660)
  }

  enter() {
    this.tone(220, 0.1, 'square', 0.04, 320)
    setTimeout(() => this.tone(440, 0.16, 'triangle', 0.05, 520), 60)
  }

  exit() {
    this.tone(330, 0.12, 'triangle', 0.04, 200)
  }

  bump(intensity = 1) {
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(90 + Math.random() * 40, now)
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.16)
    gain.gain.setValueAtTime(0.11 * Math.min(1.5, intensity), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    osc.connect(gain).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.2)
  }

  success() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((note, index) => {
      setTimeout(() => this.tone(note, 0.22, 'triangle', 0.06), index * 90)
    })
  }

  fail() {
    this.tone(240, 0.3, 'sawtooth', 0.05, 120)
  }

  siren() {
    if (!this.ctx || this.muted) return
    this.tone(760, 0.42, 'sawtooth', 0.018, 540)
    setTimeout(() => this.tone(540, 0.42, 'sawtooth', 0.018, 760), 420)
  }

  startEngine() {
    if (!this.ctx || this.engine) return
    const now = this.ctx.currentTime
    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.Q.value = 2.5

    const osc1 = this.ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc1.frequency.value = 52
    const osc2 = this.ctx.createOscillator()
    osc2.type = 'square'
    osc2.frequency.value = 26.5

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gain).connect(this.master)
    osc1.start(now)
    osc2.start(now)
    gain.gain.setTargetAtTime(0.035, now, 0.15)

    this.engine = { osc1, osc2, filter }
    this.engineGain = gain
  }

  updateEngine(speed, throttle, boosting) {
    if (!this.ctx || !this.engine) return
    const now = this.ctx.currentTime
    const abs = Math.abs(speed)
    const base = 46 + abs * 4.2 + Math.max(0, throttle) * 18
    this.engine.osc1.frequency.setTargetAtTime(base, now, 0.09)
    this.engine.osc2.frequency.setTargetAtTime(base * 0.5, now, 0.09)
    this.engine.filter.frequency.setTargetAtTime(360 + abs * 58 + (boosting ? 500 : 0), now, 0.11)
    const target = 0.018 + Math.min(0.075, abs * 0.0032) + (boosting ? 0.02 : 0)
    this.engineGain.gain.setTargetAtTime(target, now, 0.12)
  }

  stopEngine() {
    if (!this.ctx || !this.engine) return
    const now = this.ctx.currentTime
    this.engineGain.gain.setTargetAtTime(0.0001, now, 0.08)
    const engine = this.engine
    this.engine = null
    this.engineGain = null
    setTimeout(() => {
      try {
        engine.osc1.stop()
        engine.osc2.stop()
      } catch {}
    }, 400)
  }

  skid() {
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1400 + Math.random() * 400
    filter.Q.value = 4
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(700 + Math.random() * 300, now)
    gain.gain.setValueAtTime(0.03, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26)
    osc.connect(filter).connect(gain).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.3)
  }
}
