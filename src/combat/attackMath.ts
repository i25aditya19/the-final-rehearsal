// Pure hit tests for boss attacks (unit-tested in tests/attacks.test.ts).
import { V3, headingDeg, headingDiffDeg, sub, distXZ } from '../math/vec'

/** Is `p` inside a horizontal cone from `apex` facing `headingDegrees` with full width `coneDeg`? */
export function inCone(p: V3, apex: V3, headingDegrees: number, coneDeg: number, range: number): boolean {
  const d = distXZ(p, apex)
  if (d > range) return false
  if (d < 0.01) return true
  return headingDiffDeg(headingDeg(sub(p, apex)), headingDegrees) <= coneDeg / 2
}

/** Is the heading (degrees) inside any gap? Gaps are given by centre heading and full width. */
export function inGap(headingDegrees: number, gapCenters: number[], gapDeg: number): boolean {
  return gapCenters.some((c) => headingDiffDeg(headingDegrees, c) <= gapDeg / 2)
}

export type RingWave = { center: V3; radius: number; bandWidth: number; gapCenters: number[]; gapDeg: number; jumpClear: number }

/**
 * Did the wave band pass over the player between the previous and current radius? (Swept, so a
 * fast wave cannot skip a player between frames.) Gaps and a jump (feet above jumpClear) avoid it.
 */
export function ringSweptHits(player: V3, wave: RingWave, prevRadius: number, floorY = 0): boolean {
  const d = distXZ(player, wave.center)
  const lo = Math.min(prevRadius, wave.radius) - wave.bandWidth / 2
  const hi = Math.max(prevRadius, wave.radius) + wave.bandWidth / 2
  if (d < lo || d > hi) return false
  if (player.y - floorY > wave.jumpClear) return false
  return !inGap(headingDeg(sub(player, wave.center)), wave.gapCenters, wave.gapDeg)
}

/** Gap layout: the first gap sits `offsetDeg` from the player's heading, others spread evenly. */
export function gapLayout(playerHeading: number, count: number, offsetDeg: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push((((playerHeading + offsetDeg + (i * 360) / Math.max(1, count)) % 360) + 360) % 360)
  return out
}
