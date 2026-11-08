// ─────────────────────────────────────────────────────────────
// [A] Web Audio Engine
//  - 별도 음원 파일 없이도 동작하도록 모든 환경음을 Web Audio로 "합성"합니다.
//  - public/audio/{fire,birds,crickets,rain,wind,waves}.mp3 파일을 넣으면
//    자동으로 실제 녹음 음원(루프)으로 교체됩니다. (README 참고)
//  - 채널별 GainNode + 마스터 GainNode 구조라 믹서 UI와 1:1로 연결됩니다.
// ─────────────────────────────────────────────────────────────

const KEYS = ['fire', 'birds', 'crickets', 'rain', 'wind', 'waves']

function makeNoiseBuffer(ctx, type = 'white', seconds = 3) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buffer.getChannelData(0)
  if (type === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  } else if (type === 'brown') {
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  } else {
    // pink (Paul Kellet)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  return buffer
}

class AudioEngine {
  constructor() {
    this.ctx = null
    this.ready = false
    this.master = null
    this.channels = {} // key -> GainNode
    this.userVol = Object.fromEntries(KEYS.map((k) => [k, 0]))
    this.gates = Object.fromEntries(KEYS.map((k) => [k, 1])) // 불이 꺼지면 fire 게이트 0
    this.masterVol = 0.8
    this.timers = []
    this.noise = {}
  }

  /** 반드시 사용자 제스처(클릭) 안에서 호출해야 브라우저가 소리를 허용합니다. */
  async init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    this.ctx = new Ctx()
    this.alive = true // 스케줄러(크랙클/새소리) 루프용 플래그
    const ctx = this.ctx

    this.master = ctx.createGain()
    this.master.gain.value = this.masterVol
    const comp = ctx.createDynamicsCompressor()
    this.master.connect(comp).connect(ctx.destination)

    this.noise.white = makeNoiseBuffer(ctx, 'white')
    this.noise.pink = makeNoiseBuffer(ctx, 'pink')
    this.noise.brown = makeNoiseBuffer(ctx, 'brown')

    for (const k of KEYS) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(this.master)
      this.channels[k] = g
    }

    // 실제 음원 파일이 있으면 우선 사용, 없으면 합성
    for (const k of KEYS) {
      const ok = await this._tryLoadFile(k)
      if (!ok) this._buildProcedural(k)
    }

    this.ready = true
    this._applyAll(true)
  }

  async _tryLoadFile(key) {
    try {
      for (const ext of ['mp3', 'ogg', 'wav']) {
        const res = await fetch(`/audio/${key}.${ext}`)
        const type = res.headers.get('content-type') || ''
        if (!res.ok || !type.includes('audio') && !type.includes('ogg')) continue
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer())
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        src.loop = true
        src.connect(this.channels[key])
        src.start()
        return true
      }
    } catch (e) {
      /* 파일이 없거나 디코딩 실패 → 합성 사운드로 대체 */
    }
    return false
  }

  _noiseSrc(type) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise[type]
    s.loop = true
    s.start(0, Math.random() * 2)
    return s
  }

  _lfo(freq, depth, target) {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.frequency.value = freq
    g.gain.value = depth
    o.connect(g).connect(target)
    o.start()
    return o
  }

  _buildProcedural(key) {
    const ctx = this.ctx
    const out = this.channels[key]

    if (key === 'rain') {
      const n = this._noiseSrc('white')
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 900
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 9000
      const g = ctx.createGain()
      g.gain.value = 0.35
      n.connect(hp).connect(lp).connect(g).connect(out)
      // 굵은 빗방울 느낌의 저역
      const n2 = this._noiseSrc('pink')
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 400
      const g2 = ctx.createGain()
      g2.gain.value = 0.25
      n2.connect(bp).connect(g2).connect(out)
    }

    if (key === 'wind') {
      const n = this._noiseSrc('pink')
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 500
      bp.Q.value = 0.6
      const g = ctx.createGain()
      g.gain.value = 0.6
      n.connect(bp).connect(g).connect(out)
      this._lfo(0.07, 250, bp.frequency) // 바람 높낮이
      this._lfo(0.11, 0.25, g.gain) // 바람 세기
    }

    if (key === 'waves') {
      const n = this._noiseSrc('brown')
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 700
      const g = ctx.createGain()
      g.gain.value = 0.5
      n.connect(lp).connect(g).connect(out)
      this._lfo(0.1, 0.4, g.gain) // 파도가 밀려오고 빠지는 주기 (약 10초)
      this._lfo(0.1, 300, lp.frequency)
    }

    if (key === 'fire') {
      // 불의 기본음: 예전엔 저역 노이즈가 커서 "바람 소리"처럼 들렸기 때문에
      // 아주 작게만 깔고(타닥거림이 주인공), 느린 흔들림(LFO)도 제거했습니다.
      const n = this._noiseSrc('brown')
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 90 // 웅웅거리는 저음 제거
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 500
      const g = ctx.createGain()
      g.gain.value = 0.06
      n.connect(hp).connect(lp).connect(g).connect(out)
      // 타닥타닥 크랙클
      const crackle = () => {
        if (!this.alive) return
        if (this.userVol.fire * this.gates.fire > 0.01) this._crackle(out)
        const t = setTimeout(crackle, 30 + Math.random() * (Math.random() < 0.15 ? 700 : 260))
        this.timers.push(t)
      }
      crackle()
    }

    if (key === 'birds') {
      const chirp = () => {
        if (!this.alive) return
        if (this.userVol.birds > 0.01) this._birdPhrase(out)
        const t = setTimeout(chirp, 1200 + Math.random() * 4500)
        this.timers.push(t)
      }
      chirp()
    }

    if (key === 'crickets') {
      const freqs = [4300, 4650, 5000]
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const pulse = ctx.createGain()
        pulse.gain.value = 0.04
        const g = ctx.createGain()
        g.gain.value = 0.35
        o.connect(pulse).connect(g).connect(out)
        o.start()
        this._lfo(14 + i * 1.7, 0.04, pulse.gain) // 귀뚜르르 펄스
        this._lfo(1.6 + i * 0.35, 0.3, g.gain) // 울음 그룹
      })
    }
  }

  _crackle(out) {
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise.white
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1200 + Math.random() * 5000
    bp.Q.value = 1 + Math.random() * 4
    const g = ctx.createGain()
    const peak = 0.15 + Math.random() * 0.6
    const dur = 0.008 + Math.random() * 0.05
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(bp).connect(g).connect(out)
    src.start(t, Math.random() * 2, dur + 0.02)
  }

  _birdPhrase(out) {
    const ctx = this.ctx
    const base = 2200 + Math.random() * 1800
    const notes = 2 + Math.floor(Math.random() * 4)
    let t = ctx.currentTime + 0.02
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      const f0 = base * (0.9 + Math.random() * 0.4)
      const f1 = f0 * (Math.random() < 0.5 ? 1.35 : 0.7)
      o.frequency.setValueAtTime(f0, t)
      o.frequency.exponentialRampToValueAtTime(f1, t + 0.09)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 0.15)
      t += 0.1 + Math.random() * 0.08
    }
  }

  // ── 믹서 제어 ──
  _effective(key) {
    const v = this.userVol[key] * this.gates[key]
    return v < 0.01 ? 0 : v // 아주 작은 값은 완전 무음으로 처리
  }

  _applyAll(immediate = false) {
    if (!this.ready) return
    const t = this.ctx.currentTime
    for (const k of KEYS) {
      const g = this.channels[k].gain
      g.cancelScheduledValues(t)
      const target = this._effective(k)
      if (immediate) g.setValueAtTime(target, t)
      else if (target === 0) {
        // setTargetAtTime은 0에 수렴만 하므로, 부드럽게 줄인 뒤 정확히 0으로 확정
        g.setTargetAtTime(0, t, 0.12)
        g.setValueAtTime(0, t + 0.6)
      } else g.setTargetAtTime(target, t, 0.35)
    }
    this.master.gain.setTargetAtTime(this.masterVol, t, 0.2)
  }

  setVolumes(vols) {
    for (const k of KEYS) if (vols[k] !== undefined) this.userVol[k] = vols[k]
    this._applyAll()
  }

  setVolume(key, v) {
    this.userVol[key] = v
    this._applyAll()
  }

  setMaster(v) {
    this.masterVol = v
    this._applyAll()
  }

  /** 장비 상태와 연동: 예) 화로대가 꺼지면 setGate('fire', 0) */
  setGate(key, v) {
    this.gates[key] = v
    this._applyAll()
  }

  // ── 효과음 (원샷) ──
  sfx(name) {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const dest = this.master

    const noiseBurst = (type, dur, f0, f1, peak, filterType = 'lowpass') => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise[type]
      const f = ctx.createBiquadFilter()
      f.type = filterType
      f.frequency.setValueAtTime(f0, t)
      f.frequency.exponentialRampToValueAtTime(f1, t + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      src.connect(f).connect(g).connect(dest)
      src.start(t, Math.random(), dur + 0.1)
    }

    const tone = (freq, dur, peak, type = 'sine', at = 0) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t + at)
      g.gain.linearRampToValueAtTime(peak, t + at + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + at + dur)
      o.connect(g).connect(dest)
      o.start(t + at)
      o.stop(t + at + dur + 0.05)
    }

    switch (name) {
      case 'ignite':
        noiseBurst('pink', 1.1, 200, 2400, 0.5)
        break
      case 'extinguish':
        noiseBurst('white', 1.6, 6000, 800, 0.35, 'highpass')
        break
      case 'chime':
        tone(880, 1.4, 0.18)
        tone(1320, 1.2, 0.1, 'sine', 0.04)
        break
      case 'click':
        tone(520, 0.08, 0.12, 'triangle')
        break
      case 'sit':
        noiseBurst('brown', 0.35, 500, 150, 0.4)
        break
      case 'zip':
        noiseBurst('white', 0.7, 1500, 5000, 0.18, 'bandpass')
        break
      case 'pour': {
        // 드립 커피: 물 붓는 소리 + 보글보글
        noiseBurst('pink', 2.8, 1800, 900, 0.22, 'bandpass')
        for (let i = 0; i < 14; i++) tone(500 + Math.random() * 900, 0.07, 0.07, 'sine', 0.2 + i * 0.18)
        break
      }
      case 'sizzle':
        noiseBurst('white', 2.2, 7000, 2500, 0.25, 'bandpass')
        break
      default:
        break
    }
  }

  dispose() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.alive = false
    this.ready = false
    this.ctx?.close()
    this.ctx = null
  }
}

export const audio = new AudioEngine()
export { KEYS as AUDIO_KEYS }
