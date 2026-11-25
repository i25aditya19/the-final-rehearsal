// Pure aiming and hit maths for spells. No SDK imports (unit-tested in tests/aim.test.ts).
import { V3, add, clamp, dot, headingDeg, headingDiffDeg, norm, scale, sub, v3 } from '../math/vec'

/** Vertical cylinder used as the boss hit volume. */
export type HitCylinder = { center: V3; radius: number; yMin: number; yMax: number }

/**
 * First intersection of the segment origin + dir * t, t in [0, maxT], with a vertical cylinder
 * (side wall or caps). Returns t or null. `dir` must be normalized. Works as a swept test, so
 * fast spells cannot tunnel through the boss.
 */
export function segmentCylinderT(origin: V3, dir: V3, cyl: HitCylinder, maxT: number): number | null {
  // Already inside: hit immediately.
  if (insideCylinder(origin, cyl)) return 0

  const ox = origin.x - cyl.center.x
  const oz = origin.z - cyl.center.z
  let best: number | null = null

  // Side wall: solve |(o + d t).xz|^2 = r^2
  const a = dir.x * dir.x + dir.z * dir.z
  if (a > 1e-12) {
    const b = 2 * (ox * dir.x + oz * dir.z)
    const c = ox * ox + oz * oz - cyl.radius * cyl.radius
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
        if (t < 0 || t > maxT) continue
        const y = origin.y + dir.y * t
        if (y >= cyl.yMin && y <= cyl.yMax) {
          best = best === null ? t : Math.min(best, t)
          break
        }
      }
    }
  }

  // Caps: planes y = yMin and y = yMax
  if (Math.abs(dir.y) > 1e-12) {
    for (const yPlane of [cyl.yMin, cyl.yMax]) {
      const t = (yPlane - origin.y) / dir.y
      if (t < 0 || t > maxT) continue
      const px = ox + dir.x * t
      const pz = oz + dir.z * t
      if (px * px + pz * pz <= cyl.radius * cyl.radius) best = best === null ? t : Math.min(best, t)
    }
  }
  return best
}

export function insideCylinder(p: V3, cyl: HitCylinder): boolean {
  const dx = p.x - cyl.center.x
  const dz = p.z - cyl.center.z
  return dx * dx + dz * dz <= cyl.radius * cyl.radius && p.y >= cyl.yMin && p.y <= cyl.yMax
}

export type ShotInput = {
  /** Where the spell leaves the caster (avatar feet + castHeight). */
  castOrigin: V3
  /** Camera position and the world ray through the crosshair/cursor. */
  cameraPos: V3
  cameraDir: V3
  target: HitCylinder
  range: number
  aimAssistDeg: number
  bounds?: { center: V3; wallRadius: number }
}

export type ShotResult = {
  /** Normalized direction the spell actually travels from castOrigin. */
  dir: V3
  hit: boolean
  /** Where the visible trace ends (hit point or end of range). */
  end: V3
  distance: number
  assisted: boolean
}

/**
 * Third-person aiming: find what the camera ray points at (the boss volume, or a point at range),
 * then fire from the caster toward that point. Gentle aim assist snaps near-misses onto the boss
 * centre when the horizontal error is small. The resulting direction is what an echo repeats.
 */
export function computeShot(input: ShotInput): ShotResult {
  const camDir = norm(input.cameraDir)
  const camT = segmentCylinderT(input.cameraPos, camDir, input.target, input.range + 20)
  const aimPoint = camT !== null ? add(input.cameraPos, scale(camDir, camT)) : add(input.cameraPos, scale(camDir, input.range))

  let dir = norm(sub(aimPoint, input.castOrigin))
  let assisted = false

  const toBoss = sub(v3(input.target.center.x, input.castOrigin.y, input.target.center.z), input.castOrigin)
  const horizontalErr = headingDiffDeg(headingDeg(dir), headingDeg(toBoss))
  // Only assist when the player is roughly aiming level (not at the sky or the floor).
  if (horizontalErr <= input.aimAssistDeg && Math.abs(dir.y) < 0.5) {
    const bossMidY = clamp(input.castOrigin.y, input.target.yMin + 0.2, input.target.yMax - 0.2)
    const assistedDir = norm(sub(v3(input.target.center.x, bossMidY, input.target.center.z), input.castOrigin))
    if (dot(assistedDir, dir) > 0) {
      dir = assistedDir
      assisted = horizontalErr > 0.01
    }
  }

  return resolveShot(input.castOrigin, dir, input.target, input.range, assisted, input.bounds)
}

/** Trace a fixed-direction spell (direct cast or echo repeat) against the target. */
export function resolveShot(origin: V3, dir: V3, target: HitCylinder, range: number, assisted = false, bounds?: { center: V3; wallRadius: number }): ShotResult {
  const d = norm(dir)
  const t = segmentCylinderT(origin, d, target, range)
  if (t !== null) return { dir: d, hit: true, end: add(origin, scale(d, t)), distance: t, assisted }
  const stop = bounds ? stopDistance(origin, d, bounds.center, bounds.wallRadius, range) : range
  return { dir: d, hit: false, end: add(origin, scale(d, stop)), distance: stop, assisted }
}

/**
 * Which 90-degree sector around the arena centre a position is in.
 * 0 = north (+Z), 1 = east (+X), 2 = south (-Z), 3 = west (-X).
 * With `previous`, the boundary has hysteresis so standing on an engraved line does not flicker.
 */
export function sectorOf(pos: V3, center: V3, sectorCount: number, hysteresisDeg = 0, previous?: number): number {
  const width = 360 / sectorCount
  const h = headingDeg(sub(pos, center))
  const raw = Math.floor(((h + width / 2) % 360) / width) % sectorCount
  if (previous === undefined || previous === raw || hysteresisDeg <= 0) return raw
  const prevCenter = previous * width
  return headingDiffDeg(h, prevCenter) <= width / 2 + hysteresisDeg ? previous : raw
}

/**
 * Distance along `dir` (normalized) at which a missed spell stops: the arena wall (circle of
 * `wallRadius` around `center` on the floor plane), the floor (y = 0) or `range`, whichever first.
 */
export function stopDistance(origin: V3, dir: V3, center: V3, wallRadius: number, range: number): number {
  let best = range
  const ox = origin.x - center.x
  const oz = origin.z - center.z
  const a = dir.x * dir.x + dir.z * dir.z
  if (a > 1e-12) {
    const b = 2 * (ox * dir.x + oz * dir.z)
    const c = ox * ox + oz * oz - wallRadius * wallRadius
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const t = (-b + Math.sqrt(disc)) / (2 * a)
      if (t > 0) best = Math.min(best, t)
    }
  }
  if (dir.y < -1e-6) best = Math.min(best, -origin.y / dir.y)
  return Math.max(0, best)
}

/** First t in [0, maxT] where origin + dir * t enters a sphere, or null. `dir` normalized. */
export function segmentSphereT(origin: V3, dir: V3, center: V3, radius: number, maxT: number): number | null {
  const ox = origin.x - center.x
  const oy = origin.y - center.y
  const oz = origin.z - center.z
  const b = ox * dir.x + oy * dir.y + oz * dir.z
  const c = ox * ox + oy * oy + oz * oz - radius * radius
  if (c <= 0) return 0
  const disc = b * b - c
  if (disc < 0) return null
  const t = -b - Math.sqrt(disc)
  return t >= 0 && t <= maxT ? t : null
}

/** Shortest distance from point p to the segment a-b. */
export function pointSegmentDistance(p: V3, a: V3, b: V3): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const len2 = abx * abx + aby * aby + abz * abz
  let t = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const dx = a.x + abx * t - p.x
  const dy = a.y + aby * t - p.y
  const dz = a.z + abz * t - p.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
