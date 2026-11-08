import { create } from 'zustand'

// 전역 상태: 환경(시간/날씨/계절), 장비, 카메라 뷰, 사운드 볼륨, 멀티플레이
export const SOUND_KEYS = ['fire', 'birds', 'crickets', 'rain', 'wind', 'waves']

export const SOUND_LABELS = {
  fire: '모닥불',
  birds: '새소리',
  crickets: '풀벌레',
  rain: '빗소리',
  wind: '바람',
  waves: '파도',
}

export const useStore = create((set, get) => ({
  // ── 시작 화면 / 오디오 활성화 ──
  started: false,
  start: () => set({ started: true }),

  // ── 시간: 'live'면 시스템 시간, 아니면 수동(0~24) ──
  timeMode: 'live',
  manualHour: 20,
  setTimeMode: (timeMode) => set({ timeMode }),
  setManualHour: (manualHour) => set({ manualHour, timeMode: 'manual' }),

  // ── 날씨 / 계절 ──
  weather: 'clear', // clear | rain | fog | snow
  season: 'summer', // spring | summer | autumn | winter
  windStrength: 0.4,
  setWeather: (weather) => set({ weather }),
  setSeason: (season) => {
    set({ season })
    if (season === 'winter' && get().weather === 'rain') set({ weather: 'snow' })
  },
  setWindStrength: (windStrength) => set({ windStrength }),

  // ── 캠핑 사이트 ──
  people: 2, // 1~4
  tentType: 'dome', // dome | tipi
  setPeople: (people) => set({ people }),
  setTentType: (tentType) => set({ tentType }),

  // ── 장비 상태 ──
  fireOn: false,
  lanternOn: true,
  lanternTemp: 2700, // 켈빈 (2200~4500)
  stringLightsOn: true,
  roasting: false,
  brewing: false,
  toggleFire: () => set((s) => ({ fireOn: !s.fireOn, roasting: s.fireOn ? false : s.roasting })),
  toggleLantern: () => set((s) => ({ lanternOn: !s.lanternOn })),
  setLanternTemp: (lanternTemp) => set({ lanternTemp }),
  toggleStringLights: () => set((s) => ({ stringLightsOn: !s.stringLightsOn })),
  setRoasting: (roasting) => set({ roasting }),
  setBrewing: (brewing) => set({ brewing }),

  // ── 안내 토스트 ──
  toast: null,
  showToast: (msg) => {
    set({ toast: msg })
    clearTimeout(globalThis.__campToastTimer)
    globalThis.__campToastTimer = setTimeout(() => set({ toast: null }), 2600)
  },

  // ── 카메라 뷰 ──
  view: 'overview', // overview | fire | tent
  seat: 0, // 불멍 뷰에서 앉은 의자 번호
  setView: (view, seat) => set((s) => ({ view, seat: seat ?? s.seat })),

  // ── 사운드 믹서 (0~1) ──
  masterVolume: 0.8,
  volumes: { fire: 0.7, birds: 0.5, crickets: 0.5, rain: 0.0, wind: 0.3, waves: 0.0 },
  autoAmbience: true, // 날씨/시간에 따라 자동 믹스
  setMaster: (masterVolume) => set({ masterVolume }),
  setVolume: (key, v) => set((s) => ({ volumes: { ...s.volumes, [key]: v }, autoAmbience: false })),
  setAutoAmbience: (autoAmbience) => set({ autoAmbience }),
  // 자동 앰비언스가 믹스를 바꿀 때 사용 (autoAmbience 플래그는 유지)
  applyAutoVolumes: (volumes) => set((s) => ({ volumes: { ...s.volumes, ...volumes } })),

  // ── 멀티플레이 ──
  roomId: 'campsite-1',
  nickname: '',
  connected: false,
  selfId: null,
  players: {}, // id -> { id, nickname, color, pos:[x,y,z], rotY, emote }
  setRoomId: (roomId) => set({ roomId }),
  setNickname: (nickname) => set({ nickname }),
  setConnected: (connected, selfId = null) => set({ connected, selfId }),
  setPlayers: (players) => set({ players }),
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.id]: { ...s.players[p.id], ...p } } })),
  removePlayer: (id) =>
    set((s) => {
      const players = { ...s.players }
      delete players[id]
      return { players }
    }),
  myEmote: null,
  setMyEmote: (myEmote) => set({ myEmote }),
}))
