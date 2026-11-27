// Echo runtime: creation on cast, repeated spells every cycle, and Convergence on E.
import { InputAction, PointerEventType, engine, inputSystem } from '@dcl/sdk/ecs'
import { readyWindow } from '../game/assist'
import { ARENA, COLORS, CONVERGENCE, ECHO, IMPRINT } from '../config'
import { resolveShot, sectorOf } from '../combat/aim'
import { bossHitVolume } from '../boss/watcher'
import { spawnTracer } from '../effects/tracers'
import { launch } from '../effects/projectiles'
import { burst } from '../effects/vfx'
import { isActive, say, speak, state } from '../game/state'
import { hitBoss } from '../game/phases'
import { onReset } from '../game/session'
import { V3, headingDeg, sub, v3 } from '../math/vec'
import { Echo, EchoRules, convergenceDamage, placeEcho, readyGroup, scheduleNext } from './echoLogic'

const BOUNDS = { center: ARENA.center, wallRadius: ARENA.playableRadius + ARENA.borderMargin }

let idCounter = 0
const nextId = () => ++idCounter

const rules: EchoRules = {
  maxSlots: ECHO.maxSlots,
  minSeparation: ECHO.minSeparation,
  repeatInterval: ECHO.repeatInterval,
  phaseSnap: ECHO.phaseSnap,
  minFirstDelay: ECHO.minFirstDelay,
  playableRadius: ARENA.playableRadius,
  center: ARENA.center
}

export function initEchoes() {
  engine.addSystem(echoSystem)
  onReset(resetConvergenceCharge)
}

/** Called by Imprint after a direct cast: leave (or refresh) an echo where the caster stood. */
export function leaveEcho(feet: V3, origin: V3, dir: V3) {
  const r = placeEcho(state.echoes, v3(feet.x, 0, feet.z), origin, dir, state.time, rules, nextId)
  if (r.kind === 'invalid') say('Echoes only form on the engraved floor')
  else if (r.kind === 'full') say('No echo slot free')
  else if (r.kind === 'refresh') say('Echo re-imprinted', 1.2)
}

export function echoSector(e: Echo): number {
  return sectorOf(e.pos, ARENA.center, ARENA.sectorCount)
}

function echoSystem() {
  if (!isActive()) return

  // Ordinary repeats: each echo fires its stored spell on its own beat.
  for (const e of state.echoes) {
    if (e.corrupted || state.time < e.nextFire) continue
    const shot = resolveShot(e.origin, e.dir, bossHitVolume(), IMPRINT.range, false, BOUNDS)
    launch(e.origin, shot.end, COLORS.echoCyan, shot.hit, () => {
      if (shot.hit) hitBoss('echo', IMPRINT.echoDamage, undefined, shot.end)
    }, 0.8)
    if (state.echoRepeats === 0) speak('firstEcho', 'There you are. Again.')
    state.echoRepeats++
    scheduleNext(e, state.time, ECHO.repeatInterval)
  }

  // Synchronization charge in progress: break on a hit, otherwise fire together at the end.
  if (charge) {
    if (state.playerHitAt > charge.startedAt) {
      charge = undefined
      state.syncChargeUntil = 0
      say('Synchronization broken', 1.6)
    } else if (state.time >= charge.until) {
      const group = state.echoes.filter((e) => charge!.ids.includes(e.id) && !e.corrupted)
      charge = undefined
      state.syncChargeUntil = 0
      if (group.length >= CONVERGENCE.minEchoes) fireConvergence(group)
      else say('Synchronization lost: an echo was taken')
    }
  }

  if (state.time > 0.4 && inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) tryConvergence()
}

let charge: { ids: number[]; startedAt: number; until: number } | undefined
export function resetConvergenceCharge() {
  charge = undefined
}

/** E: fire every ready echo together. Invalid attempts never consume the cooldown. */
function tryConvergence() {
  if (state.time < state.convergenceReadyAt) {
    say(`Convergence recharging (${Math.ceil(state.convergenceReadyAt - state.time)}s)`)
    return
  }
  if (charge) return
  const group = readyGroup(state.echoes, state.time, readyWindow())
  if (group.length < CONVERGENCE.minEchoes) {
    const friendly = state.echoes.filter((e) => !e.corrupted)
    if (friendly.length < CONVERGENCE.minEchoes) {
      const corrupted = state.echoes.some((e) => e.corrupted)
      say(corrupted ? 'Reclaim your corrupted echo, or create another echo.' : 'Create another echo: cast from a second place.')
      return
    }
    // Not ready together: align them. They charge, then fire as one (survive the charge).
    charge = { ids: friendly.map((e) => e.id), startedAt: state.time, until: state.time + CONVERGENCE.chargeSeconds }
    state.syncChargeUntil = charge.until
    for (const e of friendly) e.nextFire = charge.until + 0.05 // hold their own repeats for the charge
    say('SYNCHRONIZING  ·  hold on', CONVERGENCE.chargeSeconds)
    return
  }
  fireConvergence(group)
}

function fireConvergence(group: Echo[]) {

  const target = bossHitVolume()
  const hitSectors = new Set<number>()
  let hits = 0
  for (const e of group) {
    const shot = resolveShot(e.origin, e.dir, target, IMPRINT.range, false, BOUNDS)
    spawnTracer(e.origin, shot.end, COLORS.syncGold, shot.hit, { width: 0.32, seconds: 0.7, intensity: 7 })
    if (shot.hit) burst(shot.end, COLORS.syncGold, 1.4)
    if (shot.hit) {
      hits++
      hitSectors.add(echoSector(e))
    }
    // Participants share a new cycle origin.
    e.lastFired = state.time
    e.nextFire = state.time + ECHO.repeatInterval
  }

  // Golden links between participating echoes, in order around the boss.
  const ordered = [...group].sort((a, b) => headingDeg(sub(a.pos, ARENA.center)) - headingDeg(sub(b.pos, ARENA.center)))
  for (let i = 0; i < ordered.length; i++) {
    if (ordered.length === 2 && i === 1) break
    const a = ordered[i]
    const b = ordered[(i + 1) % ordered.length]
    // Golden links between the synchronized echoes, thicker the larger the Convergence.
    const w = 0.08 + 0.035 * group.length
    spawnTracer(v3(a.pos.x, 0.3, a.pos.z), v3(b.pos.x, 0.3, b.pos.z), COLORS.syncGold, false, { width: w, seconds: 1.1, intensity: 4 + group.length })
    if (group.length >= 3) spawnTracer(v3(a.pos.x, 1.6, a.pos.z), v3(b.pos.x, 1.6, b.pos.z), COLORS.syncGold, false, { width: w * 0.6, seconds: 0.9, intensity: 5 })
  }
  // Visual only: a gold beam from every synchronized echo into the Watcher, and a burst on him
  // that grows with the number of echoes (a perfect four is the strongest moment in the fight).
  if (group.length >= 2) {
    const bossAt = { x: ARENA.center.x, y: 4.4, z: ARENA.center.z }
    for (const e of group) spawnTracer(v3(e.pos.x, 1.4, e.pos.z), bossAt, COLORS.syncGold, false, { width: 0.1 + 0.05 * group.length, seconds: 0.55, intensity: 5 + 1.5 * group.length })
    burst(bossAt, COLORS.syncGold, 0.6 + 0.35 * group.length)
  }

  state.convergingIds = group.map((e) => e.id)
  const out = hitBoss('convergence', convergenceDamage(hits, CONVERGENCE.damageByCount, IMPRINT.echoDamage), { hits, sectors: hitSectors.size }, { x: ARENA.center.x, y: 4, z: ARENA.center.z })
  const damage = Math.round(out.damage)
  if (hits >= 4 && hitSectors.size >= 4 && (out.damage > 0 || out.gateBroken)) state.fourWay++
  state.convergenceReadyAt = state.time + CONVERGENCE.cooldown
  state.convergences++
  state.lastConvergence = { count: group.length, hits, damage, sectors: hitSectors.size, at: state.time }
  state.bestConvergence = Math.max(state.bestConvergence, hits)
  if (hits >= 2) speak('firstSync', 'You were never meant to learn that.')
  if (out.gateBroken) say(`${hits}-WAY CONVERGENCE  ·  THE BARRIER SHATTERS`, 3)
  else if (out.deflected && hits >= 2) say(convergenceAdvice(hits, hitSectors.size), 3)
  else if (hits >= 2) say(`${hits}-WAY CONVERGENCE  ·  ${damage} damage  ·  ${hitSectors.size} sector${hitSectors.size === 1 ? '' : 's'}`, 2.5)
  else if (hits === 1) say('Convergence: only one beam reached The Watcher')
  else say('Convergence missed: echoes must face The Watcher')
}

/** Why a Convergence was blocked, in the player's terms. */
function convergenceAdvice(hits: number, sectors: number): string {
  if (state.stage === 'gate' && state.bossPhase === 2) return `Blocked: need 3 echoes from 3 sides (you had ${hits} from ${sectors})`
  if (state.bossPhase === 3 && state.time >= state.windowOpenUntil) return 'Blocked: wait for his sight to open (gold barrier)'
  if (state.bossPhase === 3) return `Blocked: need 3+ echoes from 3+ sides (you had ${hits} from ${sectors})`
  return 'Blocked by the barrier'
}
