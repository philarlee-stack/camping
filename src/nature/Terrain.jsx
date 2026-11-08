import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore } from '../store'
import { nature } from './timeOfDay'

// 지형: 계절 색 잔디, 호수, 바람에 흔들리는 나무 숲 (InstancedMesh)

const GROUND = { spring: '#6e9a4c', summer: '#4f8a3f', autumn: '#8a7a3c', winter: '#8c9a8a' }
const BROADLEAF = { spring: '#8cc46a', summer: '#3f8a45', autumn: '#d9822b', winter: '#c9d4d2' }
const PINE_BASE = new THREE.Color('#2f6b47')
const SNOW = new THREE.Color('#f2f6fa')

// 시드 고정 난수 (새로고침해도 같은 숲 모양)
function rng(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function makeTrees() {
  const r = rng(42)
  const list = []
  while (list.length < 70) {
    const a = r() * Math.PI * 2
    const d = 17 + r() * 38
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (z < -17 && Math.abs(x) < 17) continue // 호수 자리 비움
    list.push({ x, z, s: 0.8 + r() * 0.9, ph: r() * 6.28, pine: r() < 0.55 })
  }
  return list
}

function Forest() {
  const trees = useMemo(makeTrees, [])
  const pines = useMemo(() => trees.filter((t) => t.pine), [trees])
  const broad = useMemo(() => trees.filter((t) => !t.pine), [trees])

  const pineRef = useRef()
  const broadRef = useRef()
  const trunkRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])

  const pineGeo = useMemo(() => {
    const cones = [
      [2.0, 2.6, 2.0],
      [1.6, 2.4, 3.3],
      [1.1, 2.2, 4.5],
    ].map(([rad, h, y]) => {
      const g = new THREE.ConeGeometry(rad, h, 7)
      g.translate(0, y, 0)
      return g
    })
    return mergeGeometries(cones)
  }, [])
  const broadGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(2.0, 1)
    g.scale(1, 1.15, 1)
    g.translate(0, 4.0, 0)
    return g
  }, [])
  const trunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.22, 0.32, 3, 6)
    g.translate(0, 1.5, 0)
    return g
  }, [])

  // 줄기는 정적이라 한 번만 배치
  useLayoutEffect(() => {
    trees.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(t.s, t.s, t.s)
      dummy.updateMatrix()
      trunkRef.current.setMatrixAt(i, dummy.matrix)
    })
    trunkRef.current.instanceMatrix.needsUpdate = true
  }, [trees, dummy])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const wind = nature.wind
    const place = (mesh, arr) => {
      arr.forEach((tr, i) => {
        const sway = Math.sin(t * (0.7 + wind) + tr.ph) * (0.012 + wind * 0.05)
        dummy.position.set(tr.x, 0, tr.z)
        dummy.rotation.set(sway * 0.4, 0, sway)
        dummy.scale.set(tr.s, tr.s, tr.s)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    place(pineRef.current, pines)
    place(broadRef.current, broad)

    const season = useStore.getState().season
    pineRef.current.material.color.copy(PINE_BASE).lerp(SNOW, nature.groundSnow * 0.75)
    tmpColor.set(BROADLEAF[season])
    broadRef.current.material.color.lerp(tmpColor, 0.04) // 계절이 바뀔 때 천천히 물듦
    if (nature.groundSnow > 0.3) broadRef.current.material.color.lerp(SNOW, 0.02)
  })

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeo, undefined, trees.length]} castShadow>
        <meshStandardMaterial color="#5a3d28" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={pineRef} args={[pineGeo, undefined, pines.length]} castShadow>
        <meshStandardMaterial color="#2f6b47" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={broadRef} args={[broadGeo, undefined, broad.length]} castShadow>
        <meshStandardMaterial color="#3f8a45" roughness={0.9} flatShading />
      </instancedMesh>
    </>
  )
}

function Ground() {
  const season = useStore((s) => s.season)
  const mat = useRef()
  const target = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    target.set(GROUND[season]).lerp(SNOW, nature.groundSnow * 0.85)
    mat.current.color.lerp(target, 0.05)
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[90, 64]} />
      <meshStandardMaterial ref={mat} color={GROUND.summer} roughness={1} />
    </mesh>
  )
}

function Lake() {
  const mat = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // 하늘색을 반사하는 느낌 + 잔물결
    mat.current.color.set('#2c5d7a').lerp(nature.skyHorizon, 0.45)
    mat.current.emissive.copy(nature.skyHorizon).multiplyScalar(0.08)
    mat.current.roughness = 0.12 + Math.sin(t * 0.5) * 0.03
  })
  return (
    <mesh position={[0, 0.03, -34]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[15, 48]} />
      <meshStandardMaterial ref={mat} color="#2c5d7a" metalness={0.35} roughness={0.15} />
    </mesh>
  )
}

export default function Terrain() {
  return (
    <>
      <Ground />
      <Lake />
      <Forest />
    </>
  )
}
