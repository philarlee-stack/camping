# 온라인 감성 캠핑 — 기술 설계서

> 모티브: 온라인 산사(sansatemple.com)의 정적이고 힐링적인 감성.
> 목표: 밖에 나가지 않아도 자연 속 캠핑의 시간·소리·불빛을 경험하는 인터랙티브 웹 프로그램.

---

## 1. 기획 요약

### 1.1 디자인 원칙 (산사 감성)
| 원칙 | 구현 |
|---|---|
| 정적(靜的)인 분위기 | 점수·미션·타이머 없음. 모든 전환은 1.5~3초의 느린 이징 |
| 소리가 주인공 | 6채널 사운드 믹서, 날씨·시간 연동 자동 믹스 |
| 최소한의 UI | 반투명 패널 1개, `H`키로 UI 완전 숨김 |
| 따뜻한 빛 | 불빛·랜턴(2200~4500K)·알전구 3종 광원의 대비 |

### 1.2 사용자 시나리오
1. "캠핑장 입장" 클릭 → 숲속 전경이 현재 시각대로 열림
2. 의자를 클릭해 앉으면 카메라가 불멍 시점으로 이동
3. 화로대 클릭 → 불이 붙고 타닥타닥 소리가 켜짐
4. 마시멜로 꼬치를 클릭해 굽고, 드립 커피를 내림
5. 비를 내리게 하고 텐트 안으로 들어가 빗소리를 들음
6. (선택) 친구와 같은 사이트 이름으로 접속해 함께 불멍

---

## 2. 기술 스택 선정

| 영역 | 선택 | 이유 / 대안 비교 |
|---|---|---|
| 3D | **Three.js + React Three Fiber + drei** | 선언형 씬 구성, React 상태와 자연스럽게 연동. 순수 Three.js 대비 UI·장비 상태 관리가 훨씬 간단 |
| 상태 | **Zustand** | 전역 상태 + `getState()`로 프레임 루프에서 리렌더 없이 읽기 가능 |
| 카메라 | **GSAP + OrbitControls** | 위치/타깃 동시 트윈, 뷰별 제한 설정 |
| 오디오 | **Web Audio API (직접 구현)** | 별도 음원 없이 합성 가능, 채널별 GainNode 믹서에 최적. Howler.js는 파일 재생 중심이라 합성·게이트 제어에 불리 |
| 멀티플레이 | **Socket.io (Node)** | 방 단위 4인, 이벤트 중계만 필요. PartyKit/Supabase Realtime도 가능하나 자체 서버가 가장 단순하고 의존성이 적음 |
| 빌드 | **Vite** | HMR, 번들 빠름 |

### 멀티플레이 최적안 비교
| 옵션 | 장점 | 단점 | 판정 |
|---|---|---|---|
| **Socket.io** | 룸 API 내장, 구현 간단, 자체 호스팅 | 서버 직접 운영 | ✅ MVP 채택 |
| PartyKit | 엣지 배포, 룸 = Durable Object | 플랫폼 종속 | 확장기 후보 |
| Supabase Realtime | 서버리스, 인증/DB 통합 | 위치 동기화엔 지연·요금 부담 | 계정/저장 기능 추가 시 |

---

## 3. 시스템 구조

```
┌────────────────────────── Browser ──────────────────────────┐
│  React UI (패널, 믹서, 토스트)                               │
│        │ Zustand store (단일 진실 공급원)                    │
│        ├──► R3F Canvas                                       │
│        │     ├─ NatureEngine  (하늘/별/달/조명/안개/날씨)    │
│        │     ├─ Terrain       (지면/호수/숲 InstancedMesh)   │
│        │     ├─ CampSite      (화로·텐트·의자·랜턴·주방)     │
│        │     ├─ Players       (원격 아바타)                  │
│        │     └─ CameraRig     (3개 뷰 전환)                  │
│        ├──► AudioBridge ──► AudioEngine (Web Audio 그래프)   │
│        └──► multiplayer.js ◄──► Socket.io                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebSocket
                  ┌────────────▼────────────┐
                  │ Node + Express + Socket.io │
                  │  rooms: Map<roomId, {players, env}> │
                  └─────────────────────────┘
```

### 3.1 핵심 설계 결정
- **환경 값은 React 밖에서**: `nature`(timeOfDay.js)는 모듈 싱글톤 객체. `NatureEngine`이 프레임당 1회 갱신하고 다른 컴포넌트는 읽기만 합니다. → 하늘·조명이 바뀌어도 React 리렌더 0회.
- **파티클은 전부 셰이더**: 불꽃·연기·비·눈·낙엽의 위치를 버텍스 셰이더에서 `uTime`으로 계산 → CPU 업데이트 없음.
- **오디오 합성**: 음원 없이도 동작. `public/audio/*.mp3`가 있으면 자동으로 실제 녹음으로 교체.
- **멀티플레이는 이벤트 기반**: 위치를 매 프레임 보내지 않고 앉기/서기/이모트/장비 토글만 전송 → 트래픽 극소.

### 3.2 상태 모델 (store.js)
| 그룹 | 주요 필드 |
|---|---|
| 환경 | `timeMode`, `manualHour`, `weather`, `season`, `windStrength` |
| 사이트 | `people(1~4)`, `tentType(dome/tipi)` |
| 장비 | `fireOn`, `lanternOn`, `lanternTemp`, `stringLightsOn`, `roasting`, `brewing` |
| 카메라 | `view(overview/fire/tent)`, `seat` |
| 사운드 | `masterVolume`, `volumes{6채널}`, `autoAmbience` |
| 멀티 | `roomId`, `nickname`, `connected`, `players` |

### 3.3 네트워크 프로토콜
| 이벤트 | 방향 | 페이로드 |
|---|---|---|
| `join` | C→S (ack) | `{roomId, nickname}` → `{self, players, env}` / `{error:'room_full'}` |
| `state` | C→S | `{pos, rotY, sitting, emote}` |
| `player:joined` / `player:state` / `player:left` | S→C | 플레이어 정보/변경분/id |
| `env` | 양방향 | `{fireOn, lanternOn, lanternTemp, stringLightsOn, weather, season}` 변경분 |

서버 검증: 방 최대 4명, 닉네임 `<>&"'` 제거·12자 제한, 이모트 화이트리스트, 좌표 범위 클램프, 환경 키 화이트리스트.

---

## 4. 모듈별 구현 위치

| 요청 모듈 | 파일 | 요약 |
|---|---|---|
| **[A] Web Audio Engine** | `src/audio/AudioEngine.js`, `AudioBridge.jsx` | 6채널 + 마스터 GainNode, 합성(노이즈·LFO·크랙클 스케줄러), 파일 우선 로드, 효과음 8종, 불 꺼지면 fire 채널 게이트 0 |
| **[B] Day/Night & Weather** | `src/nature/timeOfDay.js`, `NatureEngine.jsx` | 시각→태양 궤도(계절별 일출/일몰), 하늘 그라디언트 셰이더, 태양·달 광원, 안개, 비/눈/낙엽 |
| **[C] Interactive Campfire** | `src/camp/Campfire.jsx` | 클릭 토글, 불꽃/불씨/연기 3층 파티클, 깜빡이는 PointLight, 마시멜로 굽기(5초 노릇→9초 탐) |
| **[D] Camera Switcher** | `src/CameraRig.jsx` | 전체/불멍/텐트 3뷰, GSAP 1.9초 이동, 1인칭 뷰에서는 제자리 고개 돌리기 |

---

## 5. 에셋 확보 전략

현재 버전은 **모든 형상이 코드로 생성(프로시저럴)** 되고 사운드도 합성이라 에셋 없이 동작합니다. 품질을 높이려면 아래를 교체/추가하세요.

### 3D 모델 (glTF/GLB)
- **Poly Pizza** (CC0/CC-BY), **Quaternius** (CC0 로우폴리 Nature/Camping 팩), **Kenney** (CC0), **Sketchfab** (CC 필터 필수, 라이선스 확인)
- 적용: `useGLTF('/models/tent.glb')` → 해당 컴포넌트의 `<mesh>` 묶음을 `<primitive>`로 교체. 클릭 영역과 `onTap`은 그대로 재사용.

### HDRI / 하늘
- **Poly Haven** (CC0) — 현재는 셰이더 하늘이라 필수는 아님. 반사 품질을 높이려면 drei `<Environment>`에 저해상도(1k) HDRI를 추가.

### 사운드 (Royalty-free)
- **freesound.org** (CC0 필터), **Pixabay Sound Effects**, **Sonniss GDC 번들**
- 파일명 규칙: `public/audio/{fire,birds,crickets,rain,wind,waves}.mp3` — 루프가 자연스러운 30~60초 클립 권장.
- 출처/라이선스는 `public/audio/CREDITS.txt`에 기록하세요.

### 아바타
- Ready Player Me(무료 SDK) 또는 Quaternius 캐릭터 → `useGLTF` + `useAnimations`로 이모트 클립 연결.

---

## 6. 성능 가이드
- 숲 70그루는 InstancedMesh 3개(줄기/침엽/활엽) → 드로우콜 최소.
- DPR 상한 1.75, 그림자맵 2048 단일 광원.
- 모바일: 비 4200선분·눈 2600입자가 부담이면 `NatureEngine.jsx`의 `COUNT`/`count` 값을 절반으로.
- 번들 1.1MB(gzip 330KB): 필요 시 `manualChunks`로 three/drei 분리.

---

## 7. 개발 로드맵

| 단계 | 기간(1인 기준) | 산출물 | 완료 기준 |
|---|---|---|---|
| **MVP (이 저장소)** | 완료 | 시간·날씨·계절, 화로/랜턴/텐트/의자/주방 상호작용, 믹서, 3뷰, 4인 룸 | 로컬에서 전 기능 시연 |
| **1. 에셋 고도화** | 2주 | glTF 장비, 실제 녹음 음원, 아바타 모델 | 프로시저럴 → 에셋 교체 후 60fps 유지 |
| **2. 감성 폴리싱** | 2주 | 후처리(Bloom, 약한 Vignette), 물결 셰이더, 반딧불, 별똥별 | 산사 감성 리뷰 통과 |
| **3. 모바일 최적화** | 1주 | 터치 제스처, 품질 프리셋(저/중/고), PWA | 중급 스마트폰 30fps 이상 |
| **4. 소셜 확장** | 2주 | 음성 채팅(WebRTC), 방 비밀번호, 닉네임/색 선택 | 4인 동시 30분 안정 |
| **5. 배포/운영** | 1주 | Docker, HTTPS(wss), 모니터링(`/healthz`), 에셋 CDN | 스테이징 → 프로덕션 |
| **6. 런칭 후** | 지속 | 사이트 테마(해변·설원), 계정/저장, 실제 날씨 API 연동 | 리텐션 지표 기반 |

### 배포 체크리스트
- [ ] `npm run build` 후 `PORT=80 node server/index.js` (또는 Docker)
- [ ] 리버스 프록시(Nginx/Caddy)에서 `/socket.io` WebSocket 업그레이드 허용
- [ ] `CORS_ORIGIN` 환경변수를 실제 도메인으로 제한
- [ ] 음원/모델 라이선스 크레딧 페이지

---

## 8. 알려진 한계
- 아바타/장비는 로우폴리 프로시저럴 형상입니다 (에셋 교체 전제).
- 멀티플레이 위치는 의자·고정 지점 기준이며 자유 이동은 미지원입니다.
- 실제 기상 API 연동은 포함되지 않습니다 (시간만 실시간).
- 서버는 인메모리 방 관리라 재시작하면 방 상태가 초기화됩니다.
