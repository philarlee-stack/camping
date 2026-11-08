// 캠핑 사이트 배치 상수 (모닥불이 원점, 텐트 입구가 +z 방향으로 불을 바라봄)
export const FIRE = [0, 0, 0]
export const TENT_POS = { dome: [0, 0, -6.2], tipi: [0, 0, -6.8] }
export const TABLE_POS = [3.9, 0, -1.4]
export const KITCHEN_POS = [-4.3, 0, -2.0]

// 인원수별 의자 위치 (불을 둘러싼 원형 배치). 각 의자는 불을 바라보도록 회전
const R = 3.0
const ANGLES = {
  1: [0.0],
  2: [-0.55, 0.55],
  3: [-0.9, 0.0, 0.9],
  4: [-1.15, -0.4, 0.4, 1.15],
}

export function chairLayout(people) {
  return (ANGLES[people] || ANGLES[2]).map((a) => {
    const x = Math.sin(a) * R
    const z = Math.cos(a) * R // +z 쪽(카메라 기본 위치 방향)에 앉음
    return { pos: [x, 0, z], rotY: Math.atan2(-x, -z) }
  })
}
