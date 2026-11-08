import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { nature, updateNature } from './timeOfDay'

// ─────────────────────────────────────────────────────────────
// [B-2] Nature Engine: 하늘 돔 + 별 + 달 + 광원 + 안개 + 날씨 파티클
// <NatureEngine /> 하나만 Canvas 안에 넣으면 됩니다.
// ─────────────────────────────────────────────────────────────

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
  }
`
const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunGlow;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, -0.2, 1.0);
    float t = pow(max(h, 0.0), 0.55);
    vec3 col = mix(uHorizon, uTop, t);
    // 지평선 아래는 안개색으로
    col = mix(col, uHorizon, 1.0 - smoothstep(-0.2, 0.0, vDir.y));
    // 태양 주변 광채
    float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 1.2) * uSunGlow;
    gl_FragColor = vec4(col, 1.0);
  }
`

function Sky() {
  // <shaderMaterial uniforms={...}> 대신 직접 만든 재질을 <primitive>로 붙여
  // 유니폼 객체가 렌더러가 보는 것과 항상 같도록 보장합니다.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: {
          uTop: { value: new THREE.Color('#3f86d6') },
          uHorizon: { value: new THREE.Color('#b9dcf3') },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uSunColor: { value: new THREE.Color('#fff2dc') },
          uSunGlow: { value: 1 },
        },
      }),
    [],
  )
  useFrame(() => {
    const u = material.uniforms
    u.uTop.value.copy(nature.skyTop)
    u.uHorizon.value.copy(nature.skyHorizon)
    u.uSunDir.value.copy(nature.sunDir)
    u.uSunColor.value.copy(nature.sunColor)
    u.uSunGlow.value = Math.max(0, 1 - nature.gray * 0.85) * (nature.elevation > -0.12 ? 1 : 0)
  })
  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[480, 32, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function Stars() {
  const pts = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(900 * 3)
    for (let i = 0; i < 900; i++) {
      const u = Math.random()
      const v = Math.random() * 0.95 + 0.05 // 위쪽 반구
      const theta = u * Math.PI * 2
      const phi = Math.acos(v)
      const r = 450
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.cos(phi)
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [])
  useFrame((state) => {
    pts.current.material.opacity = nature.starAlpha
    pts.current.visible = nature.starAlpha > 0.01
    pts.current.rotation.y = state.clock.elapsedTime * 0.002
  })
  return (
    <points ref={pts} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={900} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={1.8} sizeAttenuation={false} transparent fog={false} depthWrite={false} />
    </points>
  )
}

function Moon() {
  const ref = useRef()
  useFrame(() => {
    const m = ref.current
    m.position.copy(nature.sunDir).multiplyScalar(-420)
    m.material.opacity = THREE.MathUtils.clamp(nature.moonIntensity * 2.5, 0, 1)
    m.visible = m.material.opacity > 0.02
  })
  return (
    <mesh ref={ref} frustumCulled={false}>
      <sphereGeometry args={[14, 24, 16]} />
      <meshBasicMaterial color="#f6f1dc" transparent fog={false} />
    </mesh>
  )
}

function Lights() {
  const sun = useRef()
  const moon = useRef()
  const hemi = useRef()
  const { scene } = useThree()

  useFrame(() => {
    sun.current.position.copy(nature.sunDir).multiplyScalar(60)
    sun.current.color.copy(nature.sunColor)
    sun.current.intensity = nature.sunIntensity
    moon.current.position.copy(nature.sunDir).multiplyScalar(-60)
    moon.current.intensity = nature.moonIntensity
    hemi.current.color.copy(nature.ambientColor)
    hemi.current.groundColor.set('#2b2a22').lerp(new THREE.Color('#5c5a48'), nature.dayness)
    hemi.current.intensity = nature.ambientIntensity

    if (!scene.fog) scene.fog = new THREE.FogExp2('#000', 0.01)
    scene.fog.color.copy(nature.fogColor)
    scene.fog.density = nature.fogDensity
  })

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
      />
      <directionalLight ref={moon} color="#8fa6ff" />
    </>
  )
}

// ── 비: 셰이더로 위치를 계산하는 LineSegments (CPU 부담 없음) ──
const RAIN_VERT = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aEnd;
  uniform float uTime, uSpeed, uWind, uArea, uHeight;
  varying float vA;
  void main() {
    float y = mod(aSeed.y * uHeight - uTime * uSpeed, uHeight);
    vec3 p = vec3(aSeed.x * uArea, y, aSeed.z * uArea);
    p.x += (uHeight - y) * uWind * 0.12;
    vec3 trail = normalize(vec3(uWind * 0.12, 1.0, 0.0)) * (0.5 + aSeed.y * 0.5);
    p += aEnd * trail;
    vA = mix(1.0, 0.15, aEnd);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const RAIN_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vA;
  void main() { gl_FragColor = vec4(0.78, 0.87, 1.0, vA * uOpacity); }
`

function Rain() {
  const ref = useRef()
  const mat = useRef()
  const COUNT = 4200
  const { seed, end } = useMemo(() => {
    const seed = new Float32Array(COUNT * 2 * 3)
    const end = new Float32Array(COUNT * 2)
    const pos = new Float32Array(COUNT * 2 * 3)
    for (let i = 0; i < COUNT; i++) {
      const x = Math.random() * 2 - 1
      const y = Math.random()
      const z = Math.random() * 2 - 1
      for (let j = 0; j < 2; j++) {
        seed.set([x, y, z], (i * 2 + j) * 3)
        end[i * 2 + j] = j
      }
    }
    return { seed, end }
  }, [])
  useFrame((state) => {
    const u = mat.current.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uWind.value = nature.wind
    u.uOpacity.value = nature.rain * 0.55
    ref.current.visible = nature.rain > 0.02
  })
  return (
    <lineSegments ref={ref} frustumCulled={false} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT * 2} array={new Float32Array(COUNT * 2 * 3)} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" count={COUNT * 2} array={seed} itemSize={3} />
        <bufferAttribute attach="attributes-aEnd" count={COUNT * 2} array={end} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        vertexShader={RAIN_VERT}
        fragmentShader={RAIN_FRAG}
        uniforms={{
          uTime: { value: 0 },
          uSpeed: { value: 22 },
          uWind: { value: 0 },
          uArea: { value: 16 },
          uHeight: { value: 16 },
          uOpacity: { value: 0 },
        }}
      />
    </lineSegments>
  )
}

// ── 눈 & 나뭇잎/꽃잎: 같은 셰이더 파티클 ──
const FLAKE_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime, uFall, uWind, uArea, uHeight, uSize, uSway;
  varying float vFade;
  void main() {
    float y = mod(aSeed.y * uHeight - uTime * uFall * (0.6 + aSeed.w * 0.8), uHeight);
    float sway = sin(uTime * (0.6 + aSeed.w) + aSeed.x * 12.0) * uSway;
    vec3 p = vec3(aSeed.x * uArea + sway + uTime * uWind * (0.4 + aSeed.w), y, aSeed.z * uArea + cos(uTime * 0.7 + aSeed.z * 9.0) * uSway);
    p.x = mod(p.x + uArea, uArea * 2.0) - uArea;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // uSize는 미터 단위. 600/거리 = 대략적인 픽셀/미터
    gl_PointSize = clamp(uSize * (0.6 + aSeed.w * 0.8) * (600.0 / -mv.z), 1.0, 40.0);
    vFade = smoothstep(0.0, 1.0, y) * (1.0 - smoothstep(uHeight - 1.5, uHeight, y));
  }
`
const FLAKE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.15, d) * uOpacity * vFade);
  }
`

function Flakes({ count, color, size, fall, sway, windFactor, getOpacity }) {
  const ref = useRef()
  const mat = useRef()
  const seed = useMemo(() => {
    const a = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      a[i * 4] = Math.random() * 2 - 1
      a[i * 4 + 1] = Math.random()
      a[i * 4 + 2] = Math.random() * 2 - 1
      a[i * 4 + 3] = Math.random()
    }
    return a
  }, [count])
  useFrame((state) => {
    const u = mat.current.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uWind.value = nature.wind * windFactor
    u.uColor.value.set(color)
    const o = getOpacity()
    u.uOpacity.value = o
    ref.current.visible = o > 0.02
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={new Float32Array(count * 3)} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" count={count} array={seed} itemSize={4} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        vertexShader={FLAKE_VERT}
        fragmentShader={FLAKE_FRAG}
        uniforms={{
          uTime: { value: 0 },
          uFall: { value: fall },
          uWind: { value: 0 },
          uArea: { value: 18 },
          uHeight: { value: 14 },
          uSize: { value: size },
          uSway: { value: sway },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: 0 },
        }}
      />
    </points>
  )
}

const LEAF_COLOR = { spring: '#ffc2d6', summer: '#8fcf6a', autumn: '#e8892b', winter: '#ffffff' }

function Weather() {
  const season = useStore((s) => s.season)
  return (
    <>
      <Rain />
      <Flakes count={2600} color="#ffffff" size={0.07} fall={1.4} sway={0.8} windFactor={0.6} getOpacity={() => nature.snow * 0.95} />
      {/* 바람에 흩날리는 나뭇잎/꽃잎: 바람이 셀수록 많이 보임 */}
      <Flakes
        key={season}
        count={160}
        color={LEAF_COLOR[season]}
        size={0.13}
        fall={0.9}
        sway={1.5}
        windFactor={3.5}
        getOpacity={() => (season === 'winter' ? 0 : THREE.MathUtils.clamp((nature.wind - 0.25) * 1.6, 0, 0.9) * (1 - nature.rain * 0.6))}
      />
    </>
  )
}

export default function NatureEngine() {
  // 첫 번째 useFrame: 전체 환경 값을 한 번만 계산 (이후 컴포넌트들이 읽기만 함)
  useFrame((_, delta) => {
    const s = useStore.getState()
    updateNature(Math.min(delta, 0.1), s)
  })
  const { gl } = useThree()
  useFrame(() => gl.setClearColor(nature.skyHorizon))

  return (
    <>
      <Sky />
      <Stars />
      <Moon />
      <Lights />
      <Weather />
    </>
  )
}
