import { useMemo } from 'react'
import { useStore } from '../store'
import Campfire from './Campfire'
import Tent from './Tent'
import Kitchen from './Kitchen'
import { Chair, RollTable } from './Furniture'
import { Lantern, StringLights } from './CampLights'
import { FIRE, KITCHEN_POS, TABLE_POS, TENT_POS, chairLayout } from './layout'

const CHAIR_COLORS = ['#3b4a3f', '#4a3b3b', '#3b4352', '#5a4a2f']

// 인원수(1~4)와 텐트 종류에 따라 사이트 레이아웃이 달라집니다.
export default function CampSite() {
  const people = useStore((s) => s.people)
  const tentType = useStore((s) => s.tentType)
  const connected = useStore((s) => s.connected)
  // 온라인(멀티플레이) 접속 중에는 모두가 같은 4석 배치를 보도록 고정
  const chairs = useMemo(() => chairLayout(connected ? 4 : people), [people, connected])
  const tentZ = TENT_POS[tentType][2]

  // 텐트 양옆 기둥에 스트링 라이트를 늘어뜨림
  const from = useMemo(() => [-4.6, 2.7, tentZ + 1.2], [tentZ])
  const to = useMemo(() => [4.6, 2.7, tentZ + 1.2], [tentZ])

  return (
    <group>
      <Campfire position={FIRE} />
      <Tent />

      {chairs.map((c, i) => (
        <Chair key={i} index={i} position={c.pos} rotY={c.rotY} color={CHAIR_COLORS[i]} />
      ))}

      {/* 롤 테이블 위 감성 랜턴 */}
      <RollTable position={TABLE_POS}>
        <Lantern position={[0, 0, 0]} scale={1.3} />
      </RollTable>
      {/* 땅바닥에도 작은 랜턴 하나 (텐트 입구) */}
      <Lantern position={[1.5, 0, tentZ + 2.2]} scale={1.1} />

      <Kitchen position={KITCHEN_POS} />
      <StringLights from={from} to={to} />
    </group>
  )
}
