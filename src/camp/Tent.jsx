import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../store'
import { audio } from '../audio/AudioEngine'
import { nature } from '../nature/timeOfDay'
import { TENT_POS } from './layout'
import { SleepingBag } from './Furniture'
import { hoverProps, onTap } from './utils'

// 텐트: 소형 돔 / 대형 쉘터(티피). 클릭하면 텐트 안 ↔ 전체 뷰로 카메라가 이동합니다.
// 입구는 +z(모닥불 방향). 안쪽이 보이도록 DoubleSide + 입구 쪽 틈을 비워 둡니다.

const BAG_COLORS = ['#c0562e', '#3c6fa3', '#5b8f4c', '#a35c91']

function Interior({ people, spread }) {
  const light = useRef()
  useFrame(() => {
    // 밤에는 텐트 안이 은은하게 밝아짐
    light.current.intensity = (1 - nature.dayness) * 1.1 + 0.05
  })
  const xs = Array.from({ length: people }, (_, i) => (i - (people - 1) / 2) * spread)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[1.85, 24]} />
        <meshStandardMaterial color="#3d3a34" roughness={1} />
      </mesh>
      {xs.map((x, i) => (
        <SleepingBag key={i} position={[x, 0, -0.1]} color={BAG_COLORS[i]} />
      ))}
      <pointLight ref={light} position={[0, 1.1, 0]} color="#ffb066" distance={6} decay={1.6} />
    </group>
  )
}

export default function Tent() {
  const tentType = useStore((s) => s.tentType)
  const people = useStore((s) => s.people)
  const fabric = useRef()

  useFrame(() => {
    // 밤에는 텐트 천이 안쪽 불빛으로 은은히 빛남
    const g = (1 - nature.dayness) * 0.35
    fabric.current.emissive.set('#ff9a4a')
    fabric.current.emissiveIntensity = g
  })

  const enterOrLeave = () => {
    const s = useStore.getState()
    if (s.view === 'tent') {
      s.setView('overview')
    } else {
      s.setView('tent')
      audio.sfx('zip')
      s.showToast('텐트 안으로 들어왔어요. 다시 클릭하면 나갑니다')
    }
  }

  const pos = TENT_POS[tentType]
  const isDome = tentType === 'dome'

  return (
    <group position={pos}>
      {isDome ? (
        <>
          {/* 돔 텐트: 반구를 납작하게. 입구 쪽(+z) 틈 */}
          <mesh position={[0, 0, 0]} scale={[1.9, 1.25, 1.7]} castShadow receiveShadow {...hoverProps} onClick={onTap(enterOrLeave)}>
            <sphereGeometry args={[1, 28, 16, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1, 0, Math.PI / 2]} />
            <meshStandardMaterial ref={fabric} color="#d9822b" roughness={0.85} side={2} />
          </mesh>
          {[0, Math.PI / 2].map((r, i) => (
            <mesh key={i} rotation={[0, r, 0]} scale={[1.9, 1.25, 1.7]}>
              <torusGeometry args={[1.0, 0.012, 6, 32, Math.PI]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          ))}
          <Interior people={people} spread={0.72} />
        </>
      ) : (
        <>
          {/* 티피 텐트: 높은 원뿔 + 입구 틈 + 꼭대기 폴 */}
          <mesh position={[0, 1.7, 0]} castShadow receiveShadow {...hoverProps} onClick={onTap(enterOrLeave)}>
            <coneGeometry args={[2.3, 3.4, 10, 1, true, 0.42, Math.PI * 2 - 0.84]} />
            <meshStandardMaterial ref={fabric} color="#e6d7b8" roughness={0.9} side={2} />
          </mesh>
          {[0, 2.1, 4.2].map((r, i) => (
            <mesh key={i} position={[Math.sin(r) * 0.12, 3.6, Math.cos(r) * 0.12]} rotation={[Math.cos(r) * 0.12, 0, -Math.sin(r) * 0.12]}>
              <cylinderGeometry args={[0.03, 0.03, 1.2, 5]} />
              <meshStandardMaterial color="#5a3d28" />
            </mesh>
          ))}
          <Interior people={people} spread={0.82} />
        </>
      )}
    </group>
  )
}
