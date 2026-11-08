import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// [B-1] 시간/날씨 → 하늘색·광원·안개 계산 (순수 로직)
//  - 컴포넌트에서 매 프레임 updateNature()를 한 번 호출하고,
//    다른 컴포넌트는 `nature` 객체를 읽기만 합니다. (React 리렌더 없음)
// ─────────────────────────────────────────────────────────────

export const SEASON_DAYLIGHT = {
  spring: [5.8, 19.0],
  summer: [5.0, 20.0],
  autumn: [6.4, 18.0],
  winter: [7.4, 17.2],
}

const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

const C = (hex) => new THREE.Color(hex)
const NIGHT_TOP = C('#060a1c')
const NIGHT_HOR = C('#16213f')
const TWI_TOP = C('#2b3463')
const DUSK_HOR = C('#ff7f50')
const DAWN_HOR = C('#ffb28a')
const DAY_TOP = C('#3f86d6')
const DAY_HOR = C('#b9dcf3')
const GRAY_TOP = C('#566170')
const GRAY_HOR = C('#8c97a3')
const SUN_LOW = C('#ff9a55')
const SUN_HIGH = C('#fff2dc')
const AMB_NIGHT = C('#6f7fb8')
const AMB_DAY = C('#ffffff')
const SNOW_TINT = C('#cfd8e6')

export const nature = {
  hour: 12,
  elevation: 1,
  dayness: 1,
  isMorning: false,
  sunDir: new THREE.Vector3(0, 1, 0),
  rain: 0,
  snow: 0,
  fog: 0,
  wind: 0.3,
  gray: 0,
  skyTop: new THREE.Color(),
  skyHorizon: new THREE.Color(),
  sunColor: new THREE.Color(),
  sunIntensity: 1,
  ambientColor: new THREE.Color(),
  ambientIntensity: 0.5,
  moonIntensity: 0,
  fogColor: new THREE.Color(),
  fogDensity: 0.012,
  starAlpha: 0,
  groundSnow: 0, // 겨울/눈 날씨일 때 눈 쌓임 정도
}

/** 현재 시각(소수 시간). live면 시스템 시간, manual이면 슬라이더 값 */
export function getHour(timeMode, manualHour) {
  if (timeMode === 'manual') return manualHour
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
}

/** 시각 → 태양 궤도 각도(phi). 0=일출, π/2=정오, π=일몰, 3π/2=자정 */
export function sunPhi(hour, season) {
  const [rise, set] = SEASON_DAYLIGHT[season]
  if (hour >= rise && hour <= set) return (Math.PI * (hour - rise)) / (set - rise)
  const nightLen = 24 - (set - rise)
  const since = (hour - set + 24) % 24
  return Math.PI + (Math.PI * since) / nightLen
}

export function phaseLabel(hour, season) {
  const [rise, set] = SEASON_DAYLIGHT[season]
  if (hour >= rise - 0.6 && hour < rise + 1.2) return '일출'
  if (hour >= set - 1.3 && hour < set + 0.7) return '노을'
  if (hour >= rise + 1.2 && hour < set - 1.3) return '낮'
  return '밤'
}

const WEATHER_TARGET = {
  clear: { rain: 0, snow: 0, fog: 0 },
  rain: { rain: 1, snow: 0, fog: 0.25 },
  fog: { rain: 0, snow: 0, fog: 1 },
  snow: { rain: 0, snow: 1, fog: 0.2 },
}

/** 매 프레임 1회 호출. delta(초) 만큼 날씨를 부드럽게 전환하고 환경 값을 갱신 */
export function updateNature(delta, { timeMode, manualHour, weather, season, windStrength }) {
  const n = nature
  const hour = getHour(timeMode, manualHour)
  n.hour = hour

  // 날씨 전환 (약 2~3초에 걸쳐 부드럽게)
  const target = WEATHER_TARGET[weather] || WEATHER_TARGET.clear
  const k = 1.2
  n.rain = THREE.MathUtils.damp(n.rain, target.rain, k, delta)
  n.snow = THREE.MathUtils.damp(n.snow, target.snow, k, delta)
  n.fog = THREE.MathUtils.damp(n.fog, target.fog, k, delta)
  n.wind = THREE.MathUtils.damp(n.wind, windStrength + n.rain * 0.25, 1.5, delta)
  n.gray = Math.max(n.rain * 0.7, n.fog * 0.55, n.snow * 0.35)
  const snowTarget = season === 'winter' ? 1 : n.snow > 0.5 ? 0.8 : 0
  n.groundSnow = THREE.MathUtils.damp(n.groundSnow, snowTarget, 0.6, delta)

  // 태양 위치
  const phi = sunPhi(hour, season)
  n.sunDir.set(Math.cos(phi), Math.sin(phi), 0.3).normalize()
  const e = Math.sin(phi)
  n.elevation = e
  n.isMorning = hour < 12
  n.dayness = smooth(-0.05, 0.35, e)

  // 하늘 그라디언트
  const a = smooth(-0.2, 0.05, e)
  const b = smooth(0.05, 0.4, e)
  const twiHor = n.isMorning ? DAWN_HOR : DUSK_HOR
  n.skyTop.copy(NIGHT_TOP).lerp(TWI_TOP, a).lerp(DAY_TOP, b)
  n.skyHorizon.copy(NIGHT_HOR).lerp(twiHor, a).lerp(DAY_HOR, b)

  // 날씨에 따라 회색빛으로
  const dim = 0.25 + 0.75 * n.dayness
  const gTop = GRAY_TOP.clone().multiplyScalar(dim)
  const gHor = GRAY_HOR.clone().multiplyScalar(dim)
  n.skyTop.lerp(gTop, n.gray)
  n.skyHorizon.lerp(gHor, n.gray)
  if (n.snow > 0) n.skyHorizon.lerp(SNOW_TINT.clone().multiplyScalar(dim), n.snow * 0.35)

  // 태양/달/주변광
  n.sunColor.copy(SUN_LOW).lerp(SUN_HIGH, smooth(0.0, 0.5, e))
  n.sunIntensity = smooth(-0.02, 0.3, e) * 1.5 * (1 - n.gray * 0.75)
  n.ambientColor.copy(AMB_NIGHT).lerp(AMB_DAY, n.dayness)
  n.ambientIntensity = 0.2 + 0.45 * n.dayness * (1 - n.gray * 0.3)
  n.moonIntensity = (1 - smooth(-0.1, 0.1, e)) * 0.4 * (1 - n.gray * 0.6)

  // 안개
  n.fogColor.copy(n.skyHorizon)
  n.fogDensity = 0.011 + n.fog * 0.05 + n.rain * 0.012 + n.snow * 0.018

  n.starAlpha = (1 - smooth(-0.25, 0.0, e)) * (1 - n.gray * 0.9)
}

