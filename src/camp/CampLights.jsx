import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio/AudioEngine'
import { nature } from '../nature/timeOfDay'
import { hoverProps, kelvinToColor, onTap } from './utils'

// 감성 랜턴: 클릭으로 켜기/끄기, 색온도는 UI 슬라이더(2200K~4500K)로 조절
export function Lantern({ position = [0, 0, 0], scale = 1 }) {
  const on = useStore((s) => s.lanternOn)
  const temp = useStore((s) => s.lanternTemp)
  const light = useRef()
  const glass = useRef()
  const level = useRef(0)
  const color = useMemo(() => kelvinToColor(temp), [temp])

  useFrame((state, delta) => {
    level.current = THREE.MathUtils.damp(level.current, on ? 1 : 0, 6, delta)
    const flick = 1 + Math.sin(state.clock.elapsedTime * 9) * 0.015
    light.current.intensity = level.current * 1.7 * flick
    glass.current.emissiveIntensity = 0.1 + level.current * 2.2
  })

  const toggle = () => {
    useStore.getState().toggleLantern()
    audio.sfx('chime')
  }

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.08, 12]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.1, 0.11, 0.38, 12]} />
        <meshStandardMaterial ref={glass} color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.92} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <coneGeometry args={[0.16, 0.12, 12]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.58, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.07, 0.01, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.7} />
      </mesh>
      <pointLight ref={light} position={[0, 0.3, 0]} color={color} distance={11} decay={1.8} />
      <mesh position={[0, 0.3, 0]} visible={false} {...hoverProps} onClick={onTap(toggle)}>
        <cylinderGeometry args={[0.28, 0.28, 0.7, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}

// 앵두 알전구(스트링 라이트): 두 기둥 사이에 늘어뜨린 전구 줄
export function StringLights({ from = [-4, 2.6, 0], to = [4, 2.6, 0], sag = 0.6, count = 22 }) {
  const on = useStore((s) => s.stringLightsOn)
  const bulbs = useRef()
  const matRef = useRef()
  const level = useRef(0)

  const { curve, wire, positions } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const mid = a.clone().lerp(b, 0.5)
    mid.y -= sag
    const curve = new THREE.QuadraticBezierCurve3(a, mid.clone().setY(mid.y - sag * 0.6), b)
    const wire = new THREE.TubeGeometry(curve, 40, 0.012, 4)
    const positions = Array.from({ length: count }, (_, i) => curve.getPoint((i + 0.5) / count))
    return { curve, wire, positions }
  }, [from, to, sag, count])

  useMemo(() => curve, [curve])

  useFrame((state, delta) => {
    level.current = THREE.MathUtils.damp(level.current, on ? 1 : 0, 5, delta)
    // 밤에 더 또렷하게 보이도록 낮에는 약하게
    const night = 1 - nature.dayness * 0.7
    matRef.current.emissiveIntensity = (0.2 + level.current * 2.6) * night
    const m = new THREE.Matrix4()
    positions.forEach((p, i) => {
      const tw = 1 + Math.sin(state.clock.elapsedTime * 2 + i) * 0.06
      m.makeScale(tw, tw, tw).setPosition(p)
      bulbs.current.setMatrixAt(i, m)
    })
    bulbs.current.instanceMatrix.needsUpdate = true
  })

  const toggle = () => {
    useStore.getState().toggleStringLights()
    audio.sfx('click')
  }

  const mid = positions[Math.floor(count / 2)]

  return (
    <group>
      {[from, to].map((p, i) => (
        <mesh key={i} position={[p[0], p[1] / 2, p[2]]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, p[1], 6]} />
          <meshStandardMaterial color="#5a3d28" roughness={1} />
        </mesh>
      ))}
      <mesh geometry={wire}>
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, count]} {...hoverProps} onClick={onTap(toggle)}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial ref={matRef} color="#ffd9a0" emissive="#ffb55a" emissiveIntensity={2} toneMapped={false} />
      </instancedMesh>
      {on && mid && <pointLight position={mid.toArray()} color="#ffbd6e" intensity={0.9} distance={9} decay={1.8} />}
    </group>
  )
}
