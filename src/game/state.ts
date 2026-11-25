// Shared runtime state for the encounter. One object, reset in one place.
import { BOSS, PLAYER } from '../config'
import { Echo } from '../echoes/echoLogic'
import { BossPhase, Stage } from './phaseRules'

export type ShotLog = { kind: 'hit' | 'miss'; damage: number; assisted: boolean; at: number }
export type ConvergenceLog = { count: number; hits: number; damage: number; sectors: number; at: number }
export type Phase = 'active' | 'victory' | 'defeat'
export type EndReason = 'boss' | 'health' | 'time'

export const state = {
  /** Session clock in seconds (dt-accumulated, clamped per frame). Reset to 0 on retry. */
  time: 0,
  /** Increments on every retry; lets anything long-running detect a stale run. */
  runId: 1,
  phase: 'active' as Phase,
  endReason: undefined as EndReason | undefined,
  endedAt: 0,

  bossHp: BOSS.maxHealth as number,
  bossPhase: 1 as BossPhase,
  stage: 'fight' as Stage,
  stageStartedAt: 0,
  /** Phase II Blind Spot vulnerability ends at this time. */
  vulnerableUntil: 0,
  /** Phase III Final Observation opening ends at this time. */
  windowOpenUntil: 0,
  /** Last time the barrier deflected a spell (for feedback). */
  deflectAt: -10,
  redirects: 0,
  fourWay: 0,
  phaseProgressAt: 0,
  playerHp: PLAYER.maxVitality as number,
  playerImmuneUntil: 0,
  playerHitAt: -10,
  damageTaken: 0,
  lastHitBy: '' as string,

  imprintReadyAt: 0,
  convergenceReadyAt: 0,
  lastShot: undefined as ShotLog | undefined,
  lastConvergence: undefined as ConvergenceLog | undefined,
  bestConvergence: 0,
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
  messageUntil: 0,
  /** The Watcher's spoken line (non-blocking subtitle). */
  subtitle: '' as string,
  subtitleUntil: 0,
  saidLines: {} as Record<string, boolean>,
  score: undefined as undefined | { total: number; grade: string; speed: number; vitality: number; perfect: number; redirect: number },
  personalBest: 0,
  newBest: false
}

export const isActive = () => state.phase === 'active'

export function say(text: string, seconds = 2.2) {
  state.message = text
  state.messageUntil = state.time + seconds
}

/** The Watcher speaks a line once per run (or always, with once=false). */
export function speak(key: string, text: string, seconds = 3.5, once = true) {
  if (once && state.saidLines[key]) return
  state.saidLines[key] = true
  state.subtitle = text
  state.subtitleUntil = state.time + seconds
}

/** Damage the player once per attack event, honouring post-hit immunity. Returns damage dealt. */
export function damagePlayer(amount: number, source: string): number {
  if (!isActive() || state.time < state.playerImmuneUntil) return 0
  const dmg = Math.max(0, Math.min(amount, state.playerHp))
  state.playerHp -= dmg
  state.damageTaken += dmg
  state.playerImmuneUntil = state.time + PLAYER.postHitImmunity
  state.playerHitAt = state.time
  state.lastHitBy = source
  return dmg
}

export function resetState() {
  state.time = 0
  state.runId++
  state.phase = 'active'
  state.endReason = undefined
  state.endedAt = 0
  state.bossHp = BOSS.maxHealth
  state.bossPhase = 1
  state.stage = 'fight'
  state.stageStartedAt = 0
  state.vulnerableUntil = 0
  state.windowOpenUntil = 0
  state.deflectAt = -10
  state.redirects = 0
  state.fourWay = 0
  state.phaseProgressAt = 0
  state.playerHp = PLAYER.maxVitality
  state.playerImmuneUntil = 0
  state.playerHitAt = -10
  state.damageTaken = 0
  state.lastHitBy = ''
  state.imprintReadyAt = 0
  state.convergenceReadyAt = 0
  state.lastShot = undefined
  state.lastConvergence = undefined
  state.bestConvergence = 0
  state.shots = 0
  state.hits = 0
  state.echoRepeats = 0
  state.convergences = 0
  state.echoes = []
  state.playerSector = -1
  state.bossFlashUntil = 0
  state.message = ''
  state.messageUntil = 0
  state.subtitle = ''
  state.subtitleUntil = 0
  state.saidLines = {}
  state.score = undefined
  state.newBest = false
}
