// ─────────────────────────────────────────────────────────────
// 멀티플레이 서버 (Node + Express + Socket.io)
//  - 방(roomId) 당 최대 4명
//  - 플레이어 상태(앉기/이모트)와 캠핑장 공유 상태(불·랜턴·날씨·계절)를 중계
//  - `npm run build` 후 `npm run server` 하면 dist/ 정적 파일도 함께 서비스
// ─────────────────────────────────────────────────────────────
import express from 'express'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Server } from 'socket.io'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const MAX_PLAYERS = 4
const COLORS = ['#d9822b', '#4f8fc0', '#6aa84f', '#b5629e']
const ENV_KEYS = ['fireOn', 'lanternOn', 'lanternTemp', 'stringLightsOn', 'weather', 'season']
const EMOTES = new Set(['wave', 'gassho', 'fire', 'nod'])

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || true },
})

app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }))

const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

/** @type {Map<string, {players: Map<string, any>, env: Record<string, any>}>} */
const rooms = new Map()

const cleanRoomId = (v) => String(v || 'campsite-1').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'campsite-1'
const cleanName = (v) => String(v || '').replace(/[<>&"']/g, '').trim().slice(0, 12) || '캠퍼'
const num = (v, d = 0) => (Number.isFinite(v) ? Math.max(-100, Math.min(100, v)) : d)

io.on('connection', (socket) => {
  let roomId = null
  let me = null

  socket.on('join', (payload, ack) => {
    if (typeof ack !== 'function') return
    if (me) return ack({ error: 'already_joined' })

    const rid = cleanRoomId(payload?.roomId)
    let room = rooms.get(rid)
    if (!room) {
      room = { players: new Map(), env: {} }
      rooms.set(rid, room)
    }
    if (room.players.size >= MAX_PLAYERS) return ack({ error: 'room_full' })

    const used = new Set([...room.players.values()].map((p) => p.slot))
    let slot = 0
    while (used.has(slot)) slot++

    me = {
      id: socket.id,
      nickname: cleanName(payload?.nickname),
      color: COLORS[slot],
      slot,
      pos: [0, 0, 4],
      rotY: 0,
      sitting: false,
      emote: null,
    }
    room.players.set(socket.id, me)
    roomId = rid
    socket.join(rid)

    ack({
      self: me,
      players: Object.fromEntries(room.players),
      env: room.env,
    })
    socket.to(rid).emit('player:joined', me)
  })

  socket.on('state', (s) => {
    if (!me || !roomId || typeof s !== 'object' || !s) return
    const next = {}
    if (Array.isArray(s.pos) && s.pos.length === 3) next.pos = s.pos.map((v) => num(v))
    if (Number.isFinite(s.rotY)) next.rotY = s.rotY
    if (typeof s.sitting === 'boolean') next.sitting = s.sitting
    if ('emote' in s) next.emote = EMOTES.has(s.emote) ? s.emote : null
    Object.assign(me, next)
    socket.to(roomId).emit('player:state', { id: me.id, ...next })
  })

  socket.on('env', (e) => {
    if (!me || !roomId || typeof e !== 'object' || !e) return
    const room = rooms.get(roomId)
    if (!room) return
    const diff = {}
    for (const k of ENV_KEYS) if (k in e) diff[k] = e[k]
    Object.assign(room.env, diff)
    socket.to(roomId).emit('env', diff)
  })

  socket.on('disconnect', () => {
    if (!me || !roomId) return
    const room = rooms.get(roomId)
    if (!room) return
    room.players.delete(socket.id)
    socket.to(roomId).emit('player:left', socket.id)
    if (room.players.size === 0) rooms.delete(roomId)
  })
})

server.listen(PORT, () => {
  console.log(`🏕  camp server listening on http://localhost:${PORT}`)
})
