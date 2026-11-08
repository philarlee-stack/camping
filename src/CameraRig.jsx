import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import gsap from 'gsap'
import { useStore } from './store'
import { TENT_POS, chairLayout } from './camp/layout'

// ─────────────────────────────────────────────────────────────
// [D] Camera Position Switcher
//  - overview: 사이트 전체를 궤도 회전으로 둘러보기
//  - fire    : 내 의자에 앉아 불멍 (제자리에서 고개만 돌리는 1인칭)
//  - tent    : 텐트 안에서 입구 너머로 모닥불 바라보기
//  GSAP로 camera.position / controls.target을 함께 트윈하고,
//  이동 중에는 OrbitControls 제한을 풀었다가 도착 후 뷰별 제한을 다시 겁니다.
// ─────────────────────────────────────────────────────────────

const LOOK_DIST = 0.1 // 1인칭 뷰에서 target을 카메라 앞 0.1 지점에 두면 "고개 돌리기"가 된다

function getView(view, seat, chairCount, tentType) {
  if (view === 'fire') {
    const chairs = chairLayout(chairCount)
    const c = chairs[Math.min(seat, chairs.length - 1)]
    return {
      first: true,
      pos: [c.pos[0] * 1.05, 1.15, c.pos[2] * 1.05 + 0.05],
      look: [0, 0.8, 0],
    }
  }
  if (view === 'tent') {
    const [tx, , tz] = TENT_POS[tentType]
    return {
      first: true,
      pos: [tx, tentType === 'tipi' ? 1.25 : 0.95, tz - 0.6],
      look: [0, 0.9, 2.5],
    }
  }
  return { first: false, pos: [0, 5.6, 12.5], look: [0, 1.2, -1.5] }
}

export default function CameraRig() {
  const controls = useRef()
  const { camera } = useThree()
  const view = useStore((s) => s.view)
  const seat = useStore((s) => s.seat)
  const people = useStore((s) => s.people)
  const tentType = useStore((s) => s.tentType)
  const connected = useStore((s) => s.connected)
  const chairCount = connected ? 4 : people
  const firstRun = useRef(true)

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const cfg = getView(view, seat, chairCount, tentType)
    const pos = cfg.pos
    let tgt = cfg.look
    if (cfg.first) {
      const d = [cfg.look[0] - pos[0], cfg.look[1] - pos[1], cfg.look[2] - pos[2]]
      const len = Math.hypot(...d)
      tgt = pos.map((p, i) => p + (d[i] / len) * LOOK_DIST)
    }

    const settle = () => {
      if (cfg.first) {
        c.minDistance = LOOK_DIST
        c.maxDistance = LOOK_DIST
        c.enableZoom = false
        c.minPolarAngle = Math.PI * 0.2
        c.maxPolarAngle = Math.PI * 0.8
        c.rotateSpeed = -0.45 // 드래그 방향 = 시선 방향
      } else {
        c.minDistance = 4
        c.maxDistance = 26
        c.enableZoom = true
        c.minPolarAngle = 0.15
        c.maxPolarAngle = Math.PI / 2 - 0.04
        c.rotateSpeed = 0.7
      }
      c.enabled = true
      c.update()
    }

    gsap.killTweensOf(camera.position)
    gsap.killTweensOf(c.target)

    if (firstRun.current) {
      firstRun.current = false
      camera.position.set(...pos)
      c.target.set(...tgt)
      settle()
      return
    }

    // 이동 중에는 제한 해제
    c.enabled = false
    c.minDistance = 0.01
    c.maxDistance = 500
    c.minPolarAngle = 0
    c.maxPolarAngle = Math.PI
    c.enableZoom = false
    const ease = 'power2.inOut'
    const duration = 1.9
    gsap.to(camera.position, { x: pos[0], y: pos[1], z: pos[2], duration, ease })
    gsap.to(c.target, { x: tgt[0], y: tgt[1], z: tgt[2], duration, ease, onComplete: settle })
    return () => {
      gsap.killTweensOf(camera.position)
      gsap.killTweensOf(c.target)
    }
  }, [view, seat, chairCount, tentType, camera])

  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08} />
}
