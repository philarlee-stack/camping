import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio/AudioEngine'
import { RollTable } from './Furniture'
import { hoverProps, onTap } from './utils'

// 주방/소품: 버너+코펠, 드립 커피 세트, 마시멜로 꼬치
// 커피: 클릭 → 물 붓는 소리 + 김 올라옴 / 마시멜로: 불이 켜져 있을 때 클릭 → 불 위에서 굽기

function Steam({ active }) {
  const refs = [useRef(), useRef(), useRef()]
  useFrame((state) => {
    refs.forEach((r, i) => {
      const m = r.current
      m.visible = active
      if (!active) return
      const t = (state.clock.elapsedTime * 0.4 + i / 3) % 1
      m.position.set(Math.sin(t * 6 + i) * 0.03, t * 0.35, 0)
      m.scale.setScalar(0.04 + t * 0.07)
      m.material.opacity = (1 - t) * 0.35
    })
  })
  return (
    <group position={[0, 0.12, 0]}>
      {refs.map((r, i) => (
        <mesh key={i} ref={r}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function CoffeeSet() {
  const brewing = useStore((s) => s.brewing)
  const brew = () => {
    const s = useStore.getState()
    if (s.brewing) return
    s.setBrewing(true)
    audio.sfx('pour')
    s.showToast('드립 커피를 내리는 중… ☕')
    setTimeout(() => {
      useStore.getState().setBrewing(false)
      useStore.getState().showToast('향긋한 커피 완성!')
    }, 3600)
  }
  return (
    <group position={[-0.28, 0, 0]} {...hoverProps} onClick={onTap(brew)}>
      {/* 서버 */}
      <mesh position={[0, 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.14, 12]} />
        <meshStandardMaterial color="#d8d2c4" roughness={0.3} transparent opacity={0.9} />
      </mesh>
      {/* 드리퍼 */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <coneGeometry args={[0.08, 0.1, 12]} />
        <meshStandardMaterial color="#c0562e" roughness={0.6} />
      </mesh>
      {/* 머그 */}
      <mesh position={[0.2, 0.05, 0.05]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 10]} />
        <meshStandardMaterial color="#efe6d4" />
      </mesh>
      <group position={[0.2, 0.05, 0.05]}>
        <Steam active={brewing} />
      </group>
    </group>
  )
}

function Burner() {
  return (
    <group position={[0.1, 0, 0.05]}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.08, 10]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* 코펠 */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.12, 0.12, 16]} />
        <meshStandardMaterial color="#9aa2a8" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.18, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 0.14, 6]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </group>
  )
}

function MarshmallowBag() {
  const grill = () => {
    const s = useStore.getState()
    if (!s.fireOn) {
      s.showToast('먼저 화로대를 클릭해 불을 붙여주세요 🔥')
      audio.sfx('click')
      return
    }
    if (s.roasting) return
    s.setRoasting(true)
    audio.sfx('sizzle')
    if (s.view !== 'fire') s.setView('fire')
    s.showToast('마시멜로를 굽는 중… 꼬치를 클릭하면 먹어요')
  }
  return (
    <group position={[0.42, 0, 0.05]} {...hoverProps} onClick={onTap(grill)}>
      <mesh position={[0, 0.07, 0]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.16, 0.14, 0.07]} />
        <meshStandardMaterial color="#5aa0d6" roughness={0.7} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.1, 0.02, 0.09 + i * 0.001]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 5]} />
          <meshStandardMaterial color="#6b5237" />
        </mesh>
      ))}
    </group>
  )
}

export default function Kitchen({ position }) {
  return (
    <RollTable position={position}>
      <Burner />
      <CoffeeSet />
      <MarshmallowBag />
    </RollTable>
  )
}
