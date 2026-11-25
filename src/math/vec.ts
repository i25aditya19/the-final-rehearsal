// Pure vector helpers. No SDK imports, so they can be unit-tested in Node.

export type V3 = { x: number; y: number; z: number }

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z })
export const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
export const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z)
export const scale = (a: V3, s: number): V3 => v3(a.x * s, a.y * s, a.z * s)
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const len = (a: V3): number => Math.sqrt(dot(a, a))
export const dist = (a: V3, b: V3): number => len(sub(a, b))
export const distXZ = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.z - b.z)

export function norm(a: V3): V3 {
  const l = len(a)
  return l > 1e-9 ? scale(a, 1 / l) : v3(0, 0, 1)
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Heading of a vector on the floor plane, degrees in [0, 360): 0 = +Z (north), 90 = +X (east). */
export function headingDeg(a: V3): number {
  const deg = (Math.atan2(a.x, a.z) * 180) / Math.PI
  return (deg + 360) % 360
}

/** Smallest absolute difference between two headings, degrees in [0, 180]. */
export function headingDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}
