// Playtest telemetry: local only. At the end of every run a one-line JSON summary is printed to
// the preview console (Local Tools -> Console), tagged [FinalRehearsal telemetry]. Nothing is
// sent anywhere and no personal data is recorded. Disable with UI.telemetry = false.
import { engine } from '@dcl/sdk/ecs'
import { ARENA, UI } from '../config'
import { sectorOf } from '../combat/aim'
import { state } from './state'

const fails: Record<string, number> = {}
export function noteConvergenceFail(reason: string) {
  fails[reason] = (fails[reason] ?? 0) + 1
}

let run = -1
let firstCast = -1
let firstEcho = -1
let firstConv = -1
const phaseAt: number[] = []
const damage: Record<string, number> = {}
const echoSides = [0, 0, 0, 0]
let seenIds: number[] = []
let lastHp = 100
let lastHitAt = 0
let frames = 0
let frameTime = 0
let worstFps = 999
let restarts = 0
let reported = false

export function initTelemetry() {
  if (!UI.telemetry) return
  engine.addSystem(telemetrySystem, 10, 'telemetry')
}

function telemetrySystem(dt: number) {
  if (state.runId !== run) {
    if (run !== -1) restarts++
    run = state.runId
    firstCast = firstEcho = firstConv = -1
    phaseAt.length = 0
    for (const k of Object.keys(damage)) delete damage[k]
    for (const k of Object.keys(fails)) delete fails[k]
    echoSides.fill(0)
    seenIds = []
    lastHp = state.playerHp
    frames = 0
    frameTime = 0
    worstFps = 999
    reported = false
  }
  if (state.phase === 'active') {
    frames++
    frameTime += dt
    if (dt > 0) worstFps = Math.min(worstFps, 1 / dt)
    if (firstCast < 0 && state.shots > 0) firstCast = state.time
    if (firstEcho < 0 && state.echoes.length > 0) firstEcho = state.time
    if (firstConv < 0 && state.convergences > 0) firstConv = state.time
    if (phaseAt.length < state.bossPhase - 1) phaseAt.push(Math.round(state.time))
    for (const e of state.echoes) {
      if (!seenIds.includes(e.id)) {
        seenIds.push(e.id)
        echoSides[sectorOf(e.pos, ARENA.center, 4)]++
      }
    }
    if (state.playerHitAt !== lastHitAt) {
      lastHitAt = state.playerHitAt
      const by = state.lastHitBy ?? '?'
      damage[by] = (damage[by] ?? 0) + Math.max(0, lastHp - state.playerHp)
    }
    lastHp = state.playerHp
    return
  }
  if (reported) return
  reported = true
  const r1 = (x: number) => (x < 0 ? null : Math.round(x * 10) / 10)
  console.log(
    '[FinalRehearsal telemetry] ' +
      JSON.stringify({
        run: state.runId,
        outcome: state.phase === 'victory' ? 'victory' : `defeat:${state.endReason}`,
        deathCause: state.phase === 'defeat' ? state.lastHitBy ?? state.endReason : undefined,
        totalSeconds: r1(state.endedAt),
        guided: state.assist,
        firstCast: r1(firstCast),
        firstEcho: r1(firstEcho),
        firstConvergence: r1(firstConv),
        convergences: state.convergences,
        failedConvergence: fails,
        phaseReachedAt: phaseAt,
        phaseReached: state.bossPhase,
        seals: state.seals,
        damageTakenBy: damage,
        echoesPlacedBySide: { N: echoSides[0], E: echoSides[1], S: echoSides[2], W: echoSides[3] },
        perfectConvergences: state.fourWay,
        redirects: state.redirects,
        blindSpotHits: state.blindHits,
        score: state.score?.total,
        grade: state.score?.grade,
        restartsBefore: restarts,
        avgFps: frameTime > 0 ? Math.round(frames / frameTime) : null,
        worstFrameFps: worstFps === 999 ? null : Math.round(worstFps)
      })
  )
}
