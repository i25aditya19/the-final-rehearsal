// Guided rehearsal: offered after the first defeat (never forced). Gives a little more warning time,
// a wider Convergence ready window, easier side requirements and softer hits, so a struggling
// player still reaches the ending. Normal play is unchanged.
import { CONVERGENCE, PHASES } from '../config'
import { state } from './state'

export const ASSIST = { readyWindow: 1.6, warnBonus: 0.45, gateSectors: 2, finalSectors: 2, damageScale: 0.7 }

export const readyWindow = () => (state.assist ? ASSIST.readyWindow : CONVERGENCE.readyWindow)
export const warnBonus = () => (state.assist ? ASSIST.warnBonus : 0)

/** Copy of an attack config with longer warning (and locked aim) in guided mode. */
export function withWarn<T extends { warning: number; lockedAim?: number }>(cfg: T): T {
  const b = warnBonus()
  if (!b) return cfg
  return { ...cfg, warning: cfg.warning + b, ...(cfg.lockedAim !== undefined ? { lockedAim: cfg.lockedAim + b } : {}) }
}

export const gateSectors = () => (state.assist ? ASSIST.gateSectors : PHASES.phase2GateSectors)
export const finalSectors = () => (state.assist ? ASSIST.finalSectors : PHASES.phase3MinSectors)

// ---- Formation requirements (shared by the Convergence check and the HUD compass) ----
import { ARENA as _ARENA } from '../config'
import { sectorOf as _sectorOf } from '../combat/aim'
export const SECTOR_NAMES = ['north', 'east', 'south', 'west']
/** Distinct sides a Convergence must come from right now (0 = no requirement). */
export function requiredSectors(): number {
  if (state.bossPhase === 2 && state.stage === 'gate') return gateSectors()
  if (state.bossPhase === 3 && state.stage === 'fight') return finalSectors()
  return 0
}
/** Sectors holding at least one friendly echo, and the empty ones. */
export function formationSectors(): { covered: number[]; missing: number[] } {
  const covered = [...new Set(state.echoes.filter((e) => !e.corrupted).map((e) => _sectorOf(e.pos, _ARENA.center, 4)))]
  return { covered, missing: [0, 1, 2, 3].filter((q) => !covered.includes(q)) }
}
