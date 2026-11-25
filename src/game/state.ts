// Shared runtime state for the encounter. One object, reset in one place.
import { BOSS } from '../config'

export type ShotLog = { kind: 'hit' | 'miss' | 'blocked'; damage: number; assisted: boolean; at: number }

export const state = {
  /** Session clock in seconds (dt-accumulated, clamped per frame). */
  time: 0,
  bossHp: BOSS.maxHealth as number,
  imprintReadyAt: 0,
  lastShot: undefined as ShotLog | undefined,
  shots: 0,
  hits: 0,
  /** Current player sector around the boss, -1 when unknown. */
  playerSector: -1,
  pointerLocked: true,
  /** Seconds until the boss hit flash ends. */
  bossFlashUntil: 0
}

export function resetState() {
  state.time = 0
  state.bossHp = BOSS.maxHealth
  state.imprintReadyAt = 0
  state.lastShot = undefined
  state.shots = 0
  state.hits = 0
  state.playerSector = -1
  state.bossFlashUntil = 0
}
