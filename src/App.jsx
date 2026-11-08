import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import NatureEngine from './nature/NatureEngine'
import Terrain from './nature/Terrain'
import CampSite from './camp/CampSite'
import Players from './camp/Players'
import CameraRig from './CameraRig'
import AudioBridge from './audio/AudioBridge'
import UI from './ui/UI'
import './ui/ui.css'

export default function App() {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 55, near: 0.1, far: 1200, position: [0, 5.6, 12.5] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        {/* NatureEngine이 가장 먼저 와야 매 프레임 환경 값이 먼저 갱신됩니다 */}
        <NatureEngine />
        <Suspense fallback={null}>
          <Terrain />
          <CampSite />
          <Players />
        </Suspense>
        <CameraRig />
      </Canvas>
      <AudioBridge />
      <UI />
    </>
  )
}
