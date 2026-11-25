// Encounter state machine: ACTIVE -> VICTORY | DEFEAT -> (retry) ACTIVE.
// M3 scope: one continuous fight; phases, gates and transitions arrive in M4.
import { InputAction, PointerEventType, PointerLock, engine, inputSystem } from '@dcl/sdk/ecs'
import { SESSION } from '../config'
import { EndReason, isActive, resetState, speak, state } from './state'

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
    if (state.time > 1 && state.time < 2) speak('opening', 'Every moment leaves a trace.')
    if (state.bossHp <= 0) return endRun('boss')
    if (state.playerHp <= 0) return endRun('health')
    if (state.time >= SESSION.hardCapSeconds) return endRun('time')
    return
  }
  // Results screen: E also retries (the button needs a free cursor).
  if (state.time - state.endedAt > 1.2 && inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) retry()
}

export function endRun(reason: EndReason) {
  if (!isActive()) return
  state.phase = reason === 'boss' ? 'victory' : 'defeat'
  state.endReason = reason
  state.endedAt = state.time
  if (reason === 'boss') speak('victory', 'A moment I could not foresee...', 5, false)
  else speak('defeat', 'Another moment for my collection.', 5, false)
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

export function remainingSeconds() {
  return Math.max(0, SESSION.hardCapSeconds - state.time)
}
