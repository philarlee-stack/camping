import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio/AudioEngine'
import { nature } from '../nature/timeOfDay'
import { hoverProps, onTap } from './utils'

// ─────────────────────────────────────────────────────────────
// [C] Interactive Campfire
//  - 화로대 클릭: 불 붙이기/끄기 (파티클 + 조명 + 불멍 사운드 게이트 연동)
//  - 마시멜로 굽기 중에는 꼬치가 불 위로 나타나 점점 노릇하게 익음
// ─────────────────────────────────────────────────────────────

const P_VERT = /* glsl */ `
  attribute vec4 aSeed; // x: 각도, y: 위상, z: 반경 난수, w: 속도 난수
  uniform float uTime, uLevel, uSize, uRise, uRadius, uSpeed, uSmoke, uWind;
  varying float vLife;
  void main() {
    float life = fract(aSeed.y + uTime * uSpeed * (0.6 + aSeed.w * 0.8));
    float a = aSeed.x * 6.2831;
    float r = uRadius * mix(1.0 - life, 0.3 + life * 1.6, uSmoke) * aSeed.z;
    vec3 p;
    p.x = cos(a) * r + sin(uTime * 3.0 + a * 5.0) * 0.05 * life + life * life * uWind * 1.8 * uSmoke;
    p.y = life * uRise * (0.65 + aSeed.w * 0.7) * uLevel;
    p.z = sin(a) * r;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // uSize는 미터 단위. 600/거리 = 대략적인 픽셀/미터
    gl_PointSize = clamp(uSize * mix(1.0 - life * 0.75, 0.5 + life, uSmoke) * uLevel * (600.0 / -mv.z), 1.0, 140.0);
    vLife = life;
  }
`
const P_FRAG = /* glsl */ `
  uniform vec3 uColorA, uColorB;
  uniform float uLevel, uAlpha;
  varying float vLife;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uColorA, uColorB, vLife);
    gl_FragColor = vec4(col, soft * (1.0 - vLife) * uAlpha * uLevel);
  }
`

function Particles({ count, size, rise, radius, speed, colorA, colorB, alpha = 1, additive = true, smoke = 0, levelRef, y = 0 }) {
  const ref = useRef()
  const mat = useRef()
  const seed = useMemo(() => {
    const a = new Float32Array(count * 4)
    for (let i = 0; i < count * 4; i++) a[i] = Math.random()
    return a
  }, [count])
  useFrame((state) => {
    const u = mat.current.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uLevel.value = levelRef.current
    u.uWind.value = nature.wind
    ref.current.visible = levelRef.current > 0.01
  })
  return (
    <points ref={ref} position={[0, y, 0]} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={new Float32Array(count * 3)} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" count={count} array={seed} itemSize={4} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        vertexShader={P_VERT}
        fragmentShader={P_FRAG}
        uniforms={{
          uTime: { value: 0 },
          uLevel: { value: 0 },
          uSize: { value: size },
          uRise: { value: rise },
          uRadius: { value: radius },
          uSpeed: { value: speed },
          uSmoke: { value: smoke },
          uWind: { value: 0 },
          uAlpha: { value: alpha },
          uColorA: { value: new THREE.Color(colorA) },
          uColorB: { value: new THREE.Color(colorB) },
        }}
      />
    </points>
  )
}

function Marshmallow() {
  const roasting = useStore((s) => s.roasting)
  const group = useRef()
  const mat = useRef()
  const t0 = useRef(0)
  const raw = useMemo(() => new THREE.Color('#fff7ec'), [])
  const golden = useMemo(() => new THREE.Color('#d9a45a'), [])
  const burnt = useMemo(() => new THREE.Color('#2a1b12'), [])

  useFrame((state) => {
    if (!roasting) {
      t0.current = 0
      return
    }
    if (!t0.current) t0.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - t0.current // 경과 시간(초)
    // 0~5초: 하얀색 → 노릇, 5~9초: 노릇 → 탄 색
    if (t < 5) mat.current.color.copy(raw).lerp(golden, t / 5)
    else mat.current.color.copy(golden).lerp(burnt, Math.min((t - 5) / 4, 1))
    group.current.rotation.z = -0.9 + Math.sin(state.clock.elapsedTime * 1.6) * 0.04
    group.current.position.y = 0.95 + Math.sin(state.clock.elapsedTime * 1.2) * 0.02
  })

  if (!roasting) return null
  return (
    <group
      ref={group}
      position={[0.7, 0.95, 0.3]}
      rotation={[0, -0.4, -0.9]}
      {...hoverProps}
      onClick={onTap(() => {
        useStore.getState().setRoasting(false)
        useStore.getState().showToast('마시멜로를 맛있게 먹었어요 🍡')
        audio.sfx('click')
      })}
    >
      <mesh position={[0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 1.9, 6]} />
        <meshStandardMaterial color="#6b5237" />
      </mesh>
      <mesh position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 14]} />
        <meshStandardMaterial ref={mat} color="#fff7ec" roughness={0.9} emissive="#ff8a3d" emissiveIntensity={0.15} />
      </mesh>
    </group>
  )
}

export default function Campfire({ position = [0, 0, 0] }) {
  const fireOn = useStore((s) => s.fireOn)
  const level = useRef(0)
  const light = useRef()

  useFrame((state, delta) => {
    level.current = THREE.MathUtils.damp(level.current, fireOn ? 1 : 0, fireOn ? 3 : 1.6, delta)
    const t = state.clock.elapsedTime
    const flicker = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3 + 1) * 0.1 + Math.sin(t * 29) * 0.04
    light.current.intensity = level.current * 3.2 * flicker
  })

  const toggle = () => {
    const s = useStore.getState()
    s.toggleFire()
    audio.sfx(s.fireOn ? 'extinguish' : 'ignite')
  }

  const stones = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2
        return { x: Math.cos(a) * 0.75, z: Math.sin(a) * 0.75, s: 0.2 + ((i * 37) % 10) / 100, r: i }
      }),
    [],
  )

  return (
    <group position={position}>
      {/* 돌 화로 */}
      {stones.map((st, i) => (
        <mesh key={i} position={[st.x, st.s * 0.7, st.z]} rotation={[0, st.r, 0]} scale={[1.2, 0.8, 1]} castShadow receiveShadow>
          <dodecahedronGeometry args={[st.s, 0]} />
          <meshStandardMaterial color={i % 2 ? '#6e6a64' : '#58554f'} roughness={1} flatShading />
        </mesh>
      ))}
      {/* 장작 */}
      {[0, 1.05, 2.1].map((r, i) => (
        <mesh key={i} position={[0, 0.2, 0]} rotation={[Math.PI / 2 - 0.25, r, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.95, 7]} />
          <meshStandardMaterial color="#4a2f1c" roughness={1} emissive="#ff4a10" emissiveIntensity={fireOn ? 0.35 : 0} />
        </mesh>
      ))}

      {/* 불꽃 / 불씨 / 연기 */}
      <Particles count={220} size={0.5} rise={1.4} radius={0.34} speed={0.9} colorA="#ffc24a" colorB="#e8350a" alpha={0.28} levelRef={level} y={0.25} />
      <Particles count={70} size={0.09} rise={2.8} radius={0.25} speed={0.5} colorA="#ffe08a" colorB="#ff7a1a" alpha={0.9} levelRef={level} y={0.4} />
      <Particles count={28} size={0.9} rise={4.5} radius={0.3} speed={0.16} colorA="#6d6d72" colorB="#3a3a40" alpha={0.12} additive={false} smoke={1} levelRef={level} y={1.2} />

      <pointLight ref={light} position={[0, 0.9, 0]} color="#ff8a3d" distance={20} decay={1.7} />
      <Marshmallow />

      {/* 클릭 영역 (투명) */}
      <mesh position={[0, 0.5, 0]} visible={false} {...hoverProps} onClick={onTap(toggle)}>
        <cylinderGeometry args={[1.1, 1.1, 1.2, 12]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}
