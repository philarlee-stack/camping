import { io } from 'socket.io-client'
import { useStore } from '../store'
import { chairLayout } from '../camp/layout'

// 멀티플레이 클라이언트
//  - 위치를 매 프레임 보내지 않고 "앉기/서기/이모트" 같은 이벤트만 전송 → 트래픽 최소화
//  - 불·랜턴·날씨·계절은 방 전체가 공유 (마지막으로 바꾼 사람 기준)

const SYNC_KEYS = ['fireOn', 'lanternOn', 'lanternTemp', 'stringLightsOn', 'weather', 'season']

let socket = null
let unsubscribe = null
let applyingRemote = false

function standingSpot(slot) {
  const c = chairLayout(4)[slot % 4]
  return { pos: [c.pos[0] * 1.5, 0, c.pos[2] * 1.5], rotY: c.rotY }
}

function myState() {
  const s = useStore.getState()
  const me = s.players[s.selfId]
  const slot = me?.slot ?? 0
  if (s.view === 'fire') {
    const c = chairLayout(4)[Math.min(s.seat, 3)]
    return { pos: c.pos, rotY: c.rotY, sitting: true }
  }
  const st = standingSpot(slot)
  return { pos: st.pos, rotY: st.rotY, sitting: false }
}

export function sendState(extra = {}) {
  if (!socket?.connected) return
  socket.emit('state', { ...myState(), ...extra })
}

export function sendEmote(emote) {
  const s = useStore.getState()
  s.setMyEmote(emote)
  sendState({ emote })
  if (emote) {
    clearTimeout(sendEmote._t)
    sendEmote._t = setTimeout(() => {
      useStore.getState().setMyEmote(null)
      sendState({ emote: null })
    }, 4500)
  }
}

export function joinRoom(roomId, nickname) {
  const st = useStore.getState()
  if (socket) return
  socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })

  socket.on('connect', () => {
    socket.emit('join', { roomId, nickname }, (res) => {
      if (res?.error) {
        const msg = res.error === 'room_full' ? '이 캠핑 사이트는 이미 4명이 모두 찼어요' : '접속에 실패했어요'
        useStore.getState().showToast(msg)
        leaveRoom()
        return
      }
      useStore.getState().setConnected(true, res.self.id)
      useStore.getState().setPlayers(res.players)
      // 방에 이미 있던 공유 상태 적용
      applyEnv(res.env)
      sendState()
      useStore.getState().showToast(`'${roomId}' 사이트에 입장했어요 (${Object.keys(res.players).length}/4)`)
    })
  })

  socket.on('connect_error', () => {
    useStore.getState().showToast('멀티플레이 서버에 연결할 수 없어요 (npm run server 실행 확인)')
    leaveRoom()
  })
  socket.on('disconnect', () => useStore.getState().setConnected(false))

  socket.on('player:joined', (p) => {
    useStore.getState().upsertPlayer(p)
    useStore.getState().showToast(`${p.nickname}님이 들어왔어요`)
    sendState() // 새로 온 사람에게 내 위치 알림
  })
  socket.on('player:state', (p) => useStore.getState().upsertPlayer(p))
  socket.on('player:left', (id) => {
    const p = useStore.getState().players[id]
    if (p) useStore.getState().showToast(`${p.nickname}님이 떠났어요`)
    useStore.getState().removePlayer(id)
  })
  socket.on('env', applyEnv)

  // 내 상태 변화 → 서버로
  unsubscribe = useStore.subscribe((s, prev) => {
    if (!socket?.connected || !s.connected) return
    if (applyingRemote) return
    const diff = {}
    for (const k of SYNC_KEYS) if (s[k] !== prev[k]) diff[k] = s[k]
    if (Object.keys(diff).length) socket.emit('env', diff)
    if (s.view !== prev.view || s.seat !== prev.seat) sendState()
  })
}

function applyEnv(env) {
  if (!env || !Object.keys(env).length) return
  applyingRemote = true
  useStore.setState(env)
  applyingRemote = false
}

export function leaveRoom() {
  unsubscribe?.()
  unsubscribe = null
  socket?.disconnect()
  socket = null
  const s = useStore.getState()
  s.setConnected(false)
  s.setPlayers({})
}
