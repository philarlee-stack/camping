import { useEffect, useState } from 'react'
import { useStore, SOUND_KEYS, SOUND_LABELS } from '../store'
import { audio } from '../audio/AudioEngine'
import { nature, phaseLabel } from '../nature/timeOfDay'
import { joinRoom, leaveRoom, sendEmote } from '../net/multiplayer'
import { EMOTES } from '../camp/Avatar'

const WEATHER = [
  ['clear', '☀️ 맑음'],
  ['rain', '🌧 비'],
  ['fog', '🌫 안개'],
  ['snow', '❄️ 눈'],
]
const SEASONS = [
  ['spring', '🌸 봄'],
  ['summer', '🌿 여름'],
  ['autumn', '🍁 가을'],
  ['winter', '⛄ 겨울'],
]

const fmtHour = (h) => {
  const hh = Math.floor(h) % 24
  const mm = Math.floor((h - Math.floor(h)) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="sec">
      <button className="sec-head" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span>{open ? '–' : '+'}</span>
      </button>
      {open && <div className="sec-body">{children}</div>}
    </section>
  )
}

function Slider({ label, value, min = 0, max = 1, step = 0.01, onChange, format }) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="slider-val">{format ? format(value) : Math.round(value * 100)}</span>
    </label>
  )
}

function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map(([k, label]) => (
        <button key={k} className={'chip' + (value === k ? ' on' : '')} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function TimeSection() {
  const timeMode = useStore((s) => s.timeMode)
  const manualHour = useStore((s) => s.manualHour)
  const season = useStore((s) => s.season)
  const setTimeMode = useStore((s) => s.setTimeMode)
  const setManualHour = useStore((s) => s.setManualHour)
  const [hour, setHour] = useState(nature.hour)

  useEffect(() => {
    const id = setInterval(() => setHour(nature.hour), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <Section title={`🌅 시간  ·  ${fmtHour(hour)}  ${phaseLabel(hour, season)}`}>
      <Chips
        options={[['live', '🕒 실시간'], ['manual', '🎚 직접 조절']]}
        value={timeMode}
        onChange={(m) => {
          if (m === 'manual') setManualHour(Math.round(nature.hour * 4) / 4)
          else setTimeMode('live')
        }}
      />
      <Slider label="시각" min={0} max={24} step={0.25} value={timeMode === 'manual' ? manualHour : hour} onChange={setManualHour} format={fmtHour} />
      <div className="quick">
        {[['일출', 6], ['낮', 13], ['노을', 18.5], ['밤', 22]].map(([l, h]) => (
          <button key={l} className="mini" onClick={() => setManualHour(h)}>{l}</button>
        ))}
      </div>
    </Section>
  )
}

function WeatherSection() {
  const weather = useStore((s) => s.weather)
  const season = useStore((s) => s.season)
  const wind = useStore((s) => s.windStrength)
  const { setWeather, setSeason, setWindStrength } = useStore.getState()
  return (
    <Section title="🌦 날씨 · 계절">
      <Chips options={WEATHER} value={weather} onChange={setWeather} />
      <Chips options={SEASONS} value={season} onChange={setSeason} />
      <Slider label="바람" value={wind} onChange={setWindStrength} />
    </Section>
  )
}

function CampSection() {
  const people = useStore((s) => s.people)
  const tentType = useStore((s) => s.tentType)
  const lanternOn = useStore((s) => s.lanternOn)
  const lanternTemp = useStore((s) => s.lanternTemp)
  const stringOn = useStore((s) => s.stringLightsOn)
  const fireOn = useStore((s) => s.fireOn)
  const connected = useStore((s) => s.connected)
  const st = useStore.getState()
  return (
    <Section title="⛺ 캠핑 사이트">
      <div className="row-label">인원 {connected && <em>(온라인 중엔 4석 고정)</em>}</div>
      <Chips options={[[1, '1인'], [2, '2인'], [3, '3인'], [4, '4인']]} value={people} onChange={st.setPeople} />
      <div className="row-label">텐트</div>
      <Chips options={[['dome', '🏕 소형 돔'], ['tipi', '🛖 대형 티피']]} value={tentType} onChange={st.setTentType} />
      <div className="row-label">장비</div>
      <div className="chips">
        <button className={'chip' + (fireOn ? ' on' : '')} onClick={() => { st.toggleFire(); audio.sfx(fireOn ? 'extinguish' : 'ignite') }}>🔥 불멍</button>
        <button className={'chip' + (lanternOn ? ' on' : '')} onClick={() => { st.toggleLantern(); audio.sfx('chime') }}>🏮 랜턴</button>
        <button className={'chip' + (stringOn ? ' on' : '')} onClick={() => { st.toggleStringLights(); audio.sfx('click') }}>✨ 알전구</button>
      </div>
      <Slider label="랜턴 색온도" min={2200} max={4500} step={50} value={lanternTemp} onChange={st.setLanternTemp} format={(v) => `${Math.round(v)}K`} />
    </Section>
  )
}

function MixerSection() {
  const volumes = useStore((s) => s.volumes)
  const master = useStore((s) => s.masterVolume)
  const auto = useStore((s) => s.autoAmbience)
  const st = useStore.getState()
  return (
    <Section title="🎧 사운드 믹서">
      <Slider label="전체" value={master} onChange={st.setMaster} />
      {SOUND_KEYS.map((k) => (
        <Slider key={k} label={SOUND_LABELS[k]} value={volumes[k]} onChange={(v) => st.setVolume(k, v)} />
      ))}
      <label className="check">
        <input type="checkbox" checked={auto} onChange={(e) => st.setAutoAmbience(e.target.checked)} />
        날씨·시간에 맞춰 자동 믹스
      </label>
      <div className="hint">모닥불 소리는 불이 켜져 있을 때만 들려요.</div>
    </Section>
  )
}

function ViewSection() {
  const view = useStore((s) => s.view)
  const seat = useStore((s) => s.seat)
  const st = useStore.getState()
  return (
    <Section title="🎥 카메라" defaultOpen>
      <Chips
        options={[['overview', '🌲 전체 [1]'], ['fire', '🔥 불멍 [2]'], ['tent', '⛺ 텐트 [3]']]}
        value={view}
        onChange={(v) => st.setView(v, v === 'fire' ? seat : undefined)}
      />
    </Section>
  )
}

function SocialSection() {
  const connected = useStore((s) => s.connected)
  const players = useStore((s) => s.players)
  const roomId = useStore((s) => s.roomId)
  const nickname = useStore((s) => s.nickname)
  const myEmote = useStore((s) => s.myEmote)
  const st = useStore.getState()
  const list = Object.values(players)
  return (
    <Section title={`👥 함께 캠핑 ${connected ? `(${list.length}/4)` : ''}`} defaultOpen={false}>
      {!connected ? (
        <>
          <input className="text" placeholder="닉네임" maxLength={12} value={nickname} onChange={(e) => st.setNickname(e.target.value)} />
          <input className="text" placeholder="사이트 이름 (친구와 같게)" maxLength={24} value={roomId} onChange={(e) => st.setRoomId(e.target.value)} />
          <button className="primary" onClick={() => joinRoom(roomId || 'campsite-1', nickname || '캠퍼')}>입장하기</button>
          <div className="hint">같은 사이트 이름으로 접속하면 최대 4명이 함께 불멍할 수 있어요. (서버 실행 필요)</div>
        </>
      ) : (
        <>
          <div className="players">
            {list.map((p) => (
              <span key={p.id} className="pl" style={{ borderColor: p.color }}>
                <i style={{ background: p.color }} /> {p.nickname}
              </span>
            ))}
          </div>
          <div className="row-label">감정 표현</div>
          <div className="chips">
            {Object.entries(EMOTES).map(([k, e]) => (
              <button key={k} className={'chip' + (myEmote === k ? ' on' : '')} onClick={() => sendEmote(myEmote === k ? null : k)}>
                {e.icon} {e.label}
              </button>
            ))}
          </div>
          <button className="ghost" onClick={leaveRoom}>나가기</button>
        </>
      )}
    </Section>
  )
}

export default function UI() {
  const started = useStore((s) => s.started)
  const toast = useStore((s) => s.toast)
  const [open, setOpen] = useState(window.innerWidth > 760)
  const [hidden, setHidden] = useState(false)

  // 단축키: 1/2/3 뷰, F 불, L 랜턴, H UI 숨기기
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') return
      const st = useStore.getState()
      if (e.key === '1' || e.key === 'Escape') st.setView('overview')
      else if (e.key === '2') st.setView('fire')
      else if (e.key === '3') st.setView('tent')
      else if (e.key === 'f' || e.key === 'F') { st.toggleFire(); audio.sfx(st.fireOn ? 'extinguish' : 'ignite') }
      else if (e.key === 'l' || e.key === 'L') { st.toggleLantern(); audio.sfx('chime') }
      else if (e.key === 'h' || e.key === 'H') setHidden((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const enter = () => {
    audio.init() // 사용자 클릭 안에서 오디오 시작 (브라우저 자동재생 정책)
    useStore.getState().start()
  }

  return (
    <>
      {!started && (
        <div className="splash">
          <div className="splash-card">
            <h1>숲속 캠핑</h1>
            <p>조용한 숲, 타닥타닥 타는 모닥불, 그리고 나만의 시간.</p>
            <p className="sub">소리를 켜고 입장해 주세요 🎧</p>
            <button className="primary big" onClick={enter}>캠핑장 입장</button>
          </div>
        </div>
      )}

      {started && !hidden && (
        <>
          {!open && (
            <button className="fab" onClick={() => setOpen(true)} aria-label="메뉴 열기" title="메뉴 열기">☰ 메뉴</button>
          )}
          {open && (
            <aside className="panel">
              <div className="panel-top">
                <span>🏕 숲속 캠핑</span>
                <button className="hide-btn" onClick={() => setOpen(false)} title="사이드바 숨기기">◀ 숨기기</button>
              </div>
              <ViewSection />
              <TimeSection />
              <WeatherSection />
              <CampSection />
              <MixerSection />
              <SocialSection />
              <div className="hint foot">장비를 직접 클릭해 보세요 · 단축키 1/2/3 · F 불 · L 랜턴 · H UI 숨김</div>
            </aside>
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
