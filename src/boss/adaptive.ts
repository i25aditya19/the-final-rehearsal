// The Watcher "learns": a small, rule-based layer over the fixed per-phase attack order.
// Pure logic (unit-tested in tests/adaptive.test.ts). Fairness rules:
//  - only attacks the current phase already uses (and the gate allows) can be chosen,
//  - he adapts on at most every other attack, so the sequence stays learnable,
//  - never the same attack three times in a row,
//  - after the player has been hit repeatedly he grants extra recovery time instead of pressing.
export type AdaptiveKind = 'gaze' | 'aftershock' | 'stolen' | 'blindspot' | 'observation' | 'volley'

export type Signals = {
  /** Metres the player moved over the last ~6 s. */
  recentTravel: number
  /** Friendly (uncorrupted) echoes. */
  friendlyEchoes: number
  /** Distinct sectors those echoes occupy. */
  echoSectors: number
  /** Player hits taken in the last ~12 s. */
  recentHits: number
  corruptionReady: boolean
}

export type Choice = { kind: AdaptiveKind; reason: 'still' | 'clustered' | 'formation' }

export const ADAPTIVE = {
  stillTravel: 3.0, // under this many metres in 6 s counts as standing still
  recoveryHits: 2, // this many hits in 12 s earns extra breathing room
  recoveryBonus: 2.5 // seconds added to the next recovery
}

export function chooseAdaptive(s: Signals, allowed: AdaptiveKind[], history: AdaptiveKind[], lastWasAdaptive: boolean): Choice | undefined {
  if (lastWasAdaptive) return undefined
  const ok = (k: AdaptiveKind) => allowed.includes(k) && !(history.length >= 2 && history[history.length - 1] === k && history[history.length - 2] === k)
  // A strong, spread formation is what he most wants to break.
  if (s.friendlyEchoes >= 3 && s.echoSectors >= 2 && s.corruptionReady && ok('stolen')) return { kind: 'stolen', reason: 'formation' }
  // Everything stacked on one side: he closes that side.
  if (s.friendlyEchoes >= 2 && s.echoSectors <= 1 && ok('blindspot')) return { kind: 'blindspot', reason: 'clustered' }
  // A player who stands still gets looked at.
  if (s.recentTravel < ADAPTIVE.stillTravel && ok('gaze')) return { kind: 'gaze', reason: 'still' }
  return undefined
}

export function extraRecovery(s: Signals): number {
  return s.recentHits >= ADAPTIVE.recoveryHits ? ADAPTIVE.recoveryBonus : 0
}

export const ADAPTIVE_LINES: Record<Choice['reason'], string> = {
  still: 'You stand so still. I see you.',
  clustered: 'All your moments in one place.',
  formation: 'Such a fine formation... I will take it.'
}
