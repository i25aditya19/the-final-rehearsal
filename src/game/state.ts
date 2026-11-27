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
  /** Attack the Watcher is currently performing (for anticipation animation and sound). */
  bossCasting: undefined as string | undefined,
  bossCastAt: 0,
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
  /** End of a running Convergence synchronization charge (0 = none). */
  syncChargeUntil: 0,
  /** Watcher staggered (after a perfect Convergence) until this time. */
  staggerUntil: 0,
  /** Phase III seals broken (0-3). */
  seals: 0,
  /** Finale start time (0 = not in the finale) and whether his last resistance hit the player. */
  finaleAt: 0,
  finaleHit: false,
  /** Echo positions of the finishing Convergence, captured for the results screen. */
  finalFormation: [] as { x: number; z: number }[],
  /** Echo ids of the Convergence being resolved right now. */
  convergingIds: [] as number[],
  saidLines: {} as Record<string, boolean>,
  /** Survive retries: defeats this session and the opt-in guided mode. */
  defeats: 0,
  assist: false,
  /** Hits landed during a Blind Spot opening (for the 'The Unseen' achievement). */
  blindHits: 0,
  achievements: [] as string[],
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
  // During the finale only his last resistance can touch the player (stray bolts or a hostile
  // echo shot already in flight cannot), and it never ends the run.
  if (state.stage === 'finale' && source !== 'his last resistance') return 0
  if (!isActive() || state.time < state.playerImmuneUntil) return 0
  const dmg = Math.max(0, Math.min(amount * (state.assist ? 0.7 : 1), state.playerHp))
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
  state.bossCasting = undefined
  state.bossCastAt = 0
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
  state.syncChargeUntil = 0
  state.staggerUntil = 0
  state.seals = 0
  state.finaleAt = 0
  state.finaleHit = false
  state.finalFormation = []
  state.convergingIds = []
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
  state.blindHits = 0
  state.achievements = []
  state.newBest = false
}

/** The false victory before phase III: undefined outside it. still = frozen and silent; rewind =
 *  the temporal rewind just before the final transformation. */
export function falseVictory(): { e: number; still: boolean; rewind: boolean } | undefined {
  if (state.stage !== 'transition' || state.bossPhase !== 2) return undefined
  const e = state.time - state.stageStartedAt
  return { e, still: e < 2.8, rewind: e >= 3.3 && e < 5.0 }
}
