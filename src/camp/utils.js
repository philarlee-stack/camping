import * as THREE from 'three'

/** 색온도(K) → THREE.Color (Tanner Helland 근사식). 랜턴 색온도 슬라이더에 사용 */
export function kelvinToColor(kelvin) {
  const t = THREE.MathUtils.clamp(kelvin, 1000, 12000) / 100
  let r, g, b
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  const c = (v) => THREE.MathUtils.clamp(v, 0, 255) / 255
  return new THREE.Color(c(r), c(g), c(b))
}

/** 클릭(탭)만 처리: OrbitControls로 드래그하던 포인터 업은 무시 */
export function onTap(fn) {
  return (e) => {
    if (e.delta > 6) return
    e.stopPropagation()
    fn(e)
  }
}

/** 클릭 가능한 오브젝트 위에서 커서를 손가락 모양으로 */
export const hoverProps = {
  onPointerOver: (e) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  },
  onPointerOut: () => {
    document.body.style.cursor = 'auto'
  },
}
