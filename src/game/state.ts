// Shared runtime state for the encounter. One object, reset in one place.
import { BOSS } from '../config'
import { Echo } from '../echoes/echoLogic'

export type ShotLog = { kind: 'hit' | 'miss'; damage: number; assisted: boolean; at: number }
export type ConvergenceLog = { count: number; hits: number; damage: number; sectors: number; at: number }

export const state = {
  /** Session clock in seconds (dt-accumulated, clamped per frame). */
  time: 0,
  bossHp: BOSS.maxHealth as number,
  imprintReadyAt: 0,
  convergenceReadyAt: 0,
  lastShot: undefined as ShotLog | undefined,
  lastConvergence: undefined as ConvergenceLog | undefined,
  shots: 0,
  hits: 0,
  echoRepeats: 0,
  convergences: 0,
  echoes: [] as Echo[],
  /** Current player sector around the boss, -1 when unknown. */
  playerSector: -1,
  pointerLocked: true,
  /** Seconds until the boss hit flash ends. */
  bossFlashUntil: 0,
  /** Short feedback line under the HUD (e.g. why E did nothing). */
  message: '' as string,
  messageUntil: 0
}

export function say(text: string, seconds = 2.2) {
  state.message = text
  state.messageUntil = state.time + seconds
}

export function damageBoss(amount: number): number {
  const dmg = Math.max(0, Math.min(amount, state.bossHp))
  if (dmg <= 0) return 0
  state.bossHp -= dmg
  state.bossFlashUntil = state.time + 0.12
  if (state.bossHp <= 0) console.log('[FinalRehearsal] boss HP reached 0 (victory flow arrives in M3)')
  return dmg
}

export function resetState() {
  state.time = 0
  state.bossHp = BOSS.maxHealth
  state.imprintReadyAt = 0
  state.convergenceReadyAt = 0
  state.lastShot = undefined
  state.lastConvergence = undefined
  state.shots = 0
  state.hits = 0
  state.echoRepeats = 0
  state.convergences = 0
  state.echoes = []
  state.playerSector = -1
  state.bossFlashUntil = 0
  state.message = ''
  state.messageUntil = 0
}
