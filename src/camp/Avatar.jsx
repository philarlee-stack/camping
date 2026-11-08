import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// 감성 로우폴리 아바타. emote: wave(손 흔들기) | gassho(합장 인사) | fire(불멍) | nod(음악 듣기)
export const EMOTES = {
  wave: { label: '손 흔들기', icon: '👋' },
  gassho: { label: '합장 인사', icon: '🙏' },
  fire: { label: '불멍하기', icon: '🔥' },
  nod: { label: '음악 듣기', icon: '🎧' },
}

export default function Avatar({ player }) {
  const root = useRef()
  const body = useRef()
  const head = useRef()
  const armL = useRef()
  const armR = useRef()
  const legL = useRef()
  const legR = useRef()
  const target = useRef(new THREE.Vector3())
  const color = player.color || '#d9822b'

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const sitting = !!player.sitting
    const [px, , pz] = player.pos || [0, 0, 4]
    target.current.set(px, 0, pz)

    // 위치/방향 부드럽게 보간
    root.current.position.lerp(target.current, 1 - Math.exp(-delta * 3))
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, player.rotY || 0, 1 - Math.exp(-delta * 4))

    // 앉기/서기
    const bodyY = sitting ? 0.62 : 0.95
    body.current.position.y = THREE.MathUtils.lerp(body.current.position.y, bodyY + Math.sin(t * 1.6) * 0.008, 0.1)
    const legRot = sitting ? -Math.PI / 2.1 : 0
    legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, legRot, 0.12)
    legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, legRot, 0.12)
    legL.current.position.y = legR.current.position.y = sitting ? -0.18 : -0.05

    // 이모트 애니메이션 (기본값으로 먼저 복귀한 뒤 덮어씀)
    let armLx = 0, armLz = -0.15, armRx = 0, armRz = 0.15, headX = 0, headZ = 0, bodyX = 0
    switch (player.emote) {
      case 'wave':
        armRz = 2.5 + Math.sin(t * 9) * 0.35
        break
      case 'gassho':
        armLx = armRx = -1.15
        armLz = 0.55
        armRz = -0.55
        bodyX = 0.15 + Math.sin(t * 1.2) * 0.05
        headX = 0.15
        break
      case 'fire':
        headX = 0.28 + Math.sin(t * 0.8) * 0.03
        armLx = armRx = -0.5
        break
      case 'nod':
        headX = Math.sin(t * 5) * 0.2
        headZ = Math.sin(t * 2.5) * 0.06
        break
      default:
        break
    }
    const k = 0.15
    armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, armLx, k)
    armL.current.rotation.z = THREE.MathUtils.lerp(armL.current.rotation.z, armLz, k)
    armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, armRx, k)
    armR.current.rotation.z = THREE.MathUtils.lerp(armR.current.rotation.z, armRz, k)
    head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, headX, k)
    head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, headZ, k)
    body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, bodyX, k)
  })

  const skin = '#f0c9a4'
  return (
    <group ref={root} position={player.pos || [0, 0, 4]}>
      <group ref={body} position={[0, 0.95, 0]}>
        {/* 몸통 */}
        <mesh castShadow>
          <capsuleGeometry args={[0.2, 0.42, 6, 12]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        {/* 머리 + 비니 */}
        <group ref={head} position={[0, 0.5, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.17, 16, 12]} />
            <meshStandardMaterial color={skin} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#3a3f4a" roughness={1} />
          </mesh>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.01, 0.15]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              <meshBasicMaterial color="#222" />
            </mesh>
          ))}
        </group>
        {/* 팔 */}
        <group ref={armL} position={[-0.27, 0.22, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        </group>
        <group ref={armR} position={[0.27, 0.22, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        </group>
        {/* 다리 */}
        <group ref={legL} position={[-0.1, -0.05, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.4, 4, 8]} />
            <meshStandardMaterial color="#39414d" roughness={1} />
          </mesh>
        </group>
        <group ref={legR} position={[0.1, -0.05, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.4, 4, 8]} />
            <meshStandardMaterial color="#39414d" roughness={1} />
          </mesh>
        </group>
      </group>

      <Html position={[0, 1.95, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <div className="nametag">
          {player.emote && EMOTES[player.emote] ? EMOTES[player.emote].icon + ' ' : ''}
          {player.nickname || '캠퍼'}
        </div>
      </Html>
    </group>
  )
}
