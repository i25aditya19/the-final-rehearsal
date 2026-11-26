// Guided rehearsal: offered after two defeats (never forced). Gives a little more warning time,
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
