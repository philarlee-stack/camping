import { useStore } from '../store'
import { audio } from '../audio/AudioEngine'
import { hoverProps, onTap } from './utils'

// 침낭 + 캠핑 매트
export function SleepingBag({ position = [0, 0, 0], color = '#c0562e' }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.7, 0.04, 1.85]} />
        <meshStandardMaterial color="#5f6b73" roughness={1} />
      </mesh>
      <mesh position={[0, 0.2, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.6]} castShadow>
        <capsuleGeometry args={[0.27, 1.25, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.16, -0.78]} castShadow>
        <boxGeometry args={[0.38, 0.12, 0.28]} />
        <meshStandardMaterial color="#efe6d4" roughness={1} />
      </mesh>
    </group>
  )
}

// 릴랙스 체어: 클릭하면 앉아서 불멍 뷰로 이동 (한 번 더 클릭하면 일어남)
export function Chair({ position, rotY = 0, index = 0, color = '#3b4a3f' }) {
  const onSit = () => {
    const s = useStore.getState()
    if (s.view === 'fire' && s.seat === index) {
      s.setView('overview')
      return
    }
    s.setView('fire', index)
    audio.sfx('sit')
    s.showToast(s.fireOn ? '불멍 중… 다시 클릭하면 일어나요' : '화로대를 클릭해 불을 붙여보세요')
  }
  return (
    <group position={position} rotation={[0, rotY, 0]} {...hoverProps} onClick={onTap(onSit)}>
      {/* 좌판 */}
      <mesh position={[0, 0.42, 0]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 0.06, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* 등받이 (뒤쪽 -z 로 기울어짐) */}
      <mesh position={[0, 0.82, -0.3]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 0.75, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* 팔걸이 + 다리 */}
      {[-0.33, 0.33].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.62, 0.02]} castShadow>
            <boxGeometry args={[0.05, 0.04, 0.55]} />
            <meshStandardMaterial color="#6b5237" />
          </mesh>
          <mesh position={[x, 0.3, 0.24]} rotation={[0.2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.62, 6]} />
            <meshStandardMaterial color="#222" metalness={0.6} />
          </mesh>
          <mesh position={[x, 0.3, -0.24]} rotation={[-0.35, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.62, 6]} />
            <meshStandardMaterial color="#222" metalness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// 롤 테이블: 말아서 접는 슬랫 상판 + 철제 다리
export function RollTable({ position = [0, 0, 0], children }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.04, 0.7]} />
        <meshStandardMaterial color="#b98b5a" roughness={0.9} />
      </mesh>
      {[...Array(10)].map((_, i) => (
        <mesh key={i} position={[-0.5 + i * 0.111, 0.521, 0]}>
          <boxGeometry args={[0.005, 0.002, 0.7]} />
          <meshBasicMaterial color="#6b4a2a" />
        </mesh>
      ))}
      {[[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.25, z]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.7} />
        </mesh>
      ))}
      <group position={[0, 0.52, 0]}>{children}</group>
    </group>
  )
}
