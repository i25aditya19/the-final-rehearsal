// Pure echo rules: placement, timing, Convergence grouping and damage.
// No SDK imports — unit-tested in tests/echo.test.ts.
import { V3, distXZ } from '../math/vec'

export type Echo = {
  id: number
  /** Feet position on the floor (where the spectral figure stands). */
  pos: V3
  /** Where the repeated spell leaves the echo (cast height). */
  origin: V3
  /** Original normalized spell direction. Repeats never home in. */
  dir: V3
  /** Session time of the next repeat. */
  nextFire: number
  /** Session time the echo was created or last refreshed (oldest is replaced first). */
  placedAt: number
  corrupted: boolean
  /** Session time of the last repeat (for visuals). */
  lastFired: number
}

export type EchoRules = {
  maxSlots: number
  minSeparation: number
  repeatInterval: number
  phaseSnap: number
  minFirstDelay: number
  /** Echoes may only be placed within this radius of the arena centre. */
  playableRadius: number
  center: V3
}

export type PlaceOutcome =
  | { kind: 'new'; echo: Echo }
  | { kind: 'refresh'; echo: Echo }
  | { kind: 'replace'; echo: Echo; replacedId: number }
  | { kind: 'invalid'; reason: 'outside' }
  | { kind: 'full' }

/**
 * Time of the first repeat for an echo placed now. If the formation already has a beat, join it
 * when the natural time (now + interval) is within phaseSnap of a formation fire time.
 */
export function firstFireTime(echoes: Echo[], now: number, rules: EchoRules, excludeId?: number): number {
  const natural = now + rules.repeatInterval
  if (rules.phaseSnap <= 0) return natural
  let best: number | undefined
  for (const e of echoes) {
    if (e.corrupted || e.id === excludeId) continue
    // Formation fire times are e.nextFire + k * interval; consider the two around the natural
    // time and prefer the nearer one (the earlier one on a tie, for quicker feedback).
    const kLow = Math.floor((natural - e.nextFire) / rules.repeatInterval)
    for (const k of [kLow, kLow + 1]) {
      const candidate = e.nextFire + k * rules.repeatInterval
      if (candidate < now + rules.minFirstDelay - 1e-9) continue
      const diff = Math.abs(candidate - natural)
      if (diff > rules.phaseSnap + 1e-9) continue
      if (best === undefined || diff < Math.abs(best - natural) - 1e-9 || (Math.abs(diff - Math.abs(best - natural)) < 1e-9 && candidate < best)) best = candidate
    }
  }
  return best ?? natural
}

/** The friendly echo that a new placement would replace when all slots are full. */
export function oldestReplaceable(echoes: Echo[]): Echo | undefined {
  let oldest: Echo | undefined
  for (const e of echoes) if (!e.corrupted && (!oldest || e.placedAt < oldest.placedAt)) oldest = e
  return oldest
}

/**
 * Decide what a cast at `pos` does to the formation, and apply it to `echoes` (mutated).
 * - outside the engraved floor: no echo (the direct shot still happens)
 * - near an existing friendly echo: refresh its direction and timer
 * - free slot: new echo
 * - full: replace the oldest friendly echo (never a corrupted one); if none, 'full'
 */
export function placeEcho(echoes: Echo[], pos: V3, origin: V3, dir: V3, now: number, rules: EchoRules, nextId: () => number): PlaceOutcome {
  if (distXZ(pos, rules.center) > rules.playableRadius) return { kind: 'invalid', reason: 'outside' }

  let nearest: Echo | undefined
  let nearestD = Infinity
  for (const e of echoes) {
    const d = distXZ(e.pos, pos)
    if (d < nearestD) {
      nearestD = d
      nearest = e
    }
  }
  if (nearest && nearestD < rules.minSeparation) {
    // Too close to a corrupted echo: it cannot be refreshed away (its counterplay comes later).
    if (nearest.corrupted) return { kind: 'full' }
    nearest.pos = pos
    nearest.origin = origin
    nearest.dir = dir
    nearest.placedAt = now
    nearest.nextFire = firstFireTime(echoes, now, rules, nearest.id)
    return { kind: 'refresh', echo: nearest }
  }

  const fresh = (): Echo => ({ id: nextId(), pos, origin, dir, placedAt: now, corrupted: false, lastFired: -1, nextFire: 0 })

  if (echoes.length < rules.maxSlots) {
    const echo = fresh()
    echo.nextFire = firstFireTime(echoes, now, rules)
    echoes.push(echo)
    return { kind: 'new', echo }
  }

  const victim = oldestReplaceable(echoes)
  if (!victim) return { kind: 'full' }
  const idx = echoes.indexOf(victim)
  const echo = fresh()
  echoes.splice(idx, 1)
  echo.nextFire = firstFireTime(echoes, now, rules)
  echoes.splice(idx, 0, echo)
  return { kind: 'replace', echo, replacedId: victim.id }
}

/** Seconds until the echo's next repeat (0 when due). */
export function timeToFire(e: Echo, now: number): number {
  return Math.max(0, e.nextFire - now)
}

/** Echoes eligible for a Convergence right now: friendly and due within the ready window. */
export function readyGroup(echoes: Echo[], now: number, readyWindow: number): Echo[] {
  return echoes.filter((e) => !e.corrupted && e.nextFire - now <= readyWindow + 1e-9)
}

/**
 * Aggregate Convergence damage for the number of echoes whose beams hit. Replaces (does not add
 * to) individual echo damage. Fewer than two hitting beams deal ordinary echo damage each.
 */
export function convergenceDamage(hitCount: number, table: Record<number, number>, echoDamage: number): number {
  if (hitCount <= 0) return 0
  if (hitCount < 2) return hitCount * echoDamage
  const capped = Math.min(hitCount, 4)
  return table[capped] ?? capped * echoDamage
}

/** Advance an echo's schedule after it fires, without drifting or bursting after a hitch. */
export function scheduleNext(e: Echo, now: number, interval: number) {
  e.lastFired = now
  e.nextFire += interval
  if (e.nextFire <= now) e.nextFire = now + interval
}
