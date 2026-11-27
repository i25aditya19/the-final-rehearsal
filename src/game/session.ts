// Encounter state machine: ACTIVE -> VICTORY | DEFEAT -> (retry) ACTIVE.
// M3 scope: one continuous fight; phases, gates and transitions arrive in M4.
import { InputAction, PointerEventType, PointerLock, engine, inputSystem } from '@dcl/sdk/ecs'
import { SESSION } from '../config'
import { EndReason, isActive, resetState, speak, state } from './state'
import { masteryScore } from './phaseRules'

type ResetHook = () => void
const resetHooks: ResetHook[] = []

/** Systems register how to clear their own entities/timers on retry. */
export function onReset(hook: ResetHook) {
  resetHooks.push(hook)
}

export function initSession() {
  engine.addSystem(sessionSystem, 150000, 'session')
}

function sessionSystem() {
  if (isActive()) {
    if (state.time > 1 && state.time < 2) speak('opening', 'How many times have we rehearsed this?', 4)
    if (state.bossHp <= 0) return endRun('boss')
    if (state.playerHp <= 0) return endRun('health')
    // A finale in progress is already won: the clock cannot take it away.
    if (state.time >= SESSION.hardCapSeconds && state.stage !== 'finale') return endRun('time')
    return
  }
  // Results screen: E also retries (the button needs a free cursor).
  if (state.time - state.endedAt > (state.phase === 'victory' ? 6.5 : 1.2) && inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) retry()
}

export function endRun(reason: EndReason) {
  if (!isActive()) return
  state.phase = reason === 'boss' ? 'victory' : 'defeat'
  state.endReason = reason
  state.endedAt = state.time
  if (reason === 'boss') {
    speak('victory', 'A moment I could not foresee...', 5, false)
    state.score = masteryScore(state.time, state.playerHp, state.fourWay, state.redirects)
    state.achievements = achievements()
    if (state.assist) {
      state.newBest = state.score.total > state.personalBestGuided
      state.personalBestGuided = Math.max(state.personalBestGuided, state.score.total)
    } else {
      state.newBest = state.score.total > state.personalBest
      state.personalBest = Math.max(state.personalBest, state.score.total)
    }
  }
  else {
    speak('defeat', 'This moment is mine to keep.', 5, false)
    state.defeats++
  }
  // Free the cursor so the results button can be clicked.
  const lock = PointerLock.getMutableOrNull(engine.CameraEntity)
  if (lock) lock.isPointerLocked = false
  console.log(`[FinalRehearsal] run ended: ${reason} at ${state.time.toFixed(1)}s`)
}

/** Full reset without reloading: state, timers, echoes, attacks, effects, boss look. */
export function retry() {
  resetState()
  for (const hook of resetHooks) hook()
  console.log(`[FinalRehearsal] retry (run ${state.runId})`)
}

/** Achievements earned this run (GAME_DESIGN 10). */
function achievements(): string[] {
  const a: string[] = []
  if (state.time < 180) a.push('PRODIGY')
  if (state.damageTaken === 0) a.push('UNTOUCHABLE')
  if (state.fourWay > 0) a.push('PERFECT HARMONY')
  if (state.blindHits > 0) a.push('THE UNSEEN')
  if (state.redirects > 0) a.push('USURPER')
  if (state.score?.grade === 'S') a.push('MASTER OF MOMENTS')
  return a
}

/** Retry in guided mode (offered after two defeats). */
export function retryGuided() {
  state.assist = true
  retry()
}

export function remainingSeconds() {
  return Math.max(0, SESSION.hardCapSeconds - state.time)
}
