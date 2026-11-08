import { useEffect } from 'react'
import { useStore } from '../store'
import { audio } from './AudioEngine'
import { nature } from '../nature/timeOfDay'

// 스토어(믹서 UI 상태) ↔ AudioEngine 연결 + 날씨/시간 기반 자동 앰비언스
export default function AudioBridge() {
  const started = useStore((s) => s.started)
  const volumes = useStore((s) => s.volumes)
  const master = useStore((s) => s.masterVolume)
  const fireOn = useStore((s) => s.fireOn)

  // 시작 버튼(사용자 제스처) 이후 AudioContext 생성
  useEffect(() => {
    if (!started) return
    audio.init().then(() => {
      const s = useStore.getState()
      audio.setVolumes(s.volumes)
      audio.setMaster(s.masterVolume)
      audio.setGate('fire', s.fireOn ? 1 : 0)
    })
  }, [started])

  useEffect(() => { audio.setVolumes(volumes) }, [volumes])
  useEffect(() => { audio.setMaster(master) }, [master])
  useEffect(() => { audio.setGate('fire', fireOn ? 1 : 0) }, [fireOn])

  // 자동 앰비언스: 0.6초마다 날씨·시간·계절에 맞춰 믹스를 조정 (사용자가 슬라이더를 만지면 자동 해제)
  useEffect(() => {
    const id = setInterval(() => {
      const s = useStore.getState()
      if (!s.started || !s.autoAmbience) return
      const night = 1 - nature.dayness
      const calm = 1 - Math.max(nature.rain, nature.snow * 0.6)
      const winter = s.season === 'winter'
      const next = {
        birds: winter ? 0.12 * nature.dayness * calm : 0.6 * nature.dayness * calm,
        crickets: winter ? 0 : (s.season === 'summer' ? 0.65 : 0.4) * night * calm,
        rain: nature.rain * 0.85,
        wind: Math.min(1, 0.1 + nature.wind * 0.9),
        waves: 0.14 * calm,
      }
      const cur = s.volumes
      const changed = Object.keys(next).some((k) => Math.abs(next[k] - cur[k]) > 0.02)
      if (changed) s.applyAutoVolumes(next)
    }, 600)
    return () => clearInterval(id)
  }, [])

  return null
}
