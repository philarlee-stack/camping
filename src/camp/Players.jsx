import { useStore } from '../store'
import Avatar from './Avatar'

// 다른 접속자 아바타 렌더링 (내 아바타는 1인칭이라 그리지 않음)
export default function Players() {
  const players = useStore((s) => s.players)
  const selfId = useStore((s) => s.selfId)
  return (
    <>
      {Object.values(players)
        .filter((p) => p.id !== selfId)
        .map((p) => (
          <Avatar key={p.id} player={p} />
        ))}
    </>
  )
}
