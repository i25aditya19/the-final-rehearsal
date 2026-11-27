// Pure phase/damage rules (GAME_DESIGN 7-8). No SDK imports; tested in tests/phases.test.ts.

export type BossPhase = 1 | 2 | 3
export type Stage = 'fight' | 'gate' | 'transition' | 'finale'
export type DamageKind = 'direct' | 'echo' | 'convergence' | 'redirect'

export type PhaseRules = {
  phaseHealth: number
  phase2OrdinaryMultiplier: number
  phase2GateSectors: number
  phase3MinSectors: number
  phase3MinEchoes: number
  /** Phase III is three seals: each qualifying Convergence breaks one, whatever its size. */
  phase3SealDamage: number
}

export type BossCtx = {
  phase: BossPhase
  stage: Stage
  hp: number
  /** Blind Spot vulnerability (phase II): ordinary spells deal full damage. */
  vulnerable: boolean
  /** Final Observation opening (phase III): the barrier admits a qualifying Convergence. */
  windowOpen: boolean
}

export type Convergence = { hits: number; sectors: number }

export type DamageOutcome = {
  damage: number
  /** The hit was stopped by a barrier (show a deflection). */
  deflected: boolean
  /** A gate was broken: move to the transition into the next phase. */
  gateBroken: boolean
  /** HP reached this phase's floor: raise the gate. */
  reachedFloor: boolean
  /** Phase III: a seal broke (1, 2) or the last seal broke and the finale begins (3). */
  seal?: number
  /** The last seal broke: hold at 1 HP for the finale (the finishing attack kills). */
  finale?: boolean
}

/** HP floor of a phase: phase I ends at 200, phase II at 100, phase III at 0. */
export function phaseFloor(phase: BossPhase, rules: PhaseRules): number {
  return Math.max(0, (3 - phase) * rules.phaseHealth)
}

/** Does a Convergence satisfy the current gate or the phase III barrier? */
export function convergenceQualifies(ctx: BossCtx, conv: Convergence, rules: PhaseRules): boolean {
  if (ctx.phase === 1) return conv.hits >= 2
  if (ctx.phase === 2) return conv.hits >= Math.max(2, rules.phase2GateSectors) && conv.sectors >= rules.phase2GateSectors
  return conv.hits >= rules.phase3MinEchoes && conv.sectors >= rules.phase3MinSectors
}

export function resolveBossDamage(ctx: BossCtx, kind: DamageKind, amount: number, rules: PhaseRules, conv?: Convergence): DamageOutcome {
  const none = (deflected: boolean): DamageOutcome => ({ damage: 0, deflected, gateBroken: false, reachedFloor: false })
  if (ctx.stage === 'transition' || ctx.stage === 'finale' || amount <= 0 || ctx.hp <= 0) return none(false)

  // Gates: only the teaching Convergence breaks them; gate-opening damage never carries over.
  if (ctx.stage === 'gate') {
    if (kind === 'convergence' && conv && ctx.phase < 3 && convergenceQualifies(ctx, conv, rules)) {
      return { damage: 0, deflected: false, gateBroken: true, reachedFloor: false }
    }
    return none(true)
  }

  let dmg = amount
  if (ctx.phase === 2 && (kind === 'direct' || kind === 'echo') && !ctx.vulnerable) dmg = amount * rules.phase2OrdinaryMultiplier
  if (ctx.phase === 3) {
    // The Final Observation barrier: only a qualifying multi-direction Convergence during an
    // opening gets through. Redirected corruption can never bypass it.
    const ok = kind === 'convergence' && conv && ctx.windowOpen && convergenceQualifies(ctx, conv, rules)
    if (!ok) return none(true)
    // One seal per qualifying Convergence (3 echoes or 4: same progress, so a three-echo strategy
    // needs exactly three openings). The last seal does not kill: it starts the finale.
    const remaining = ctx.hp - rules.phase3SealDamage
    if (remaining <= 0.5) return { damage: ctx.hp - 1, deflected: false, gateBroken: false, reachedFloor: false, seal: 3, finale: true }
    const seal = Math.round((rules.phaseHealth - remaining) / rules.phase3SealDamage)
    return { damage: rules.phase3SealDamage, deflected: false, gateBroken: false, reachedFloor: false, seal }
  }

  const floor = phaseFloor(ctx.phase, rules)
  const allowed = Math.max(0, ctx.hp - floor)
  dmg = Math.min(dmg, allowed)
  const after = ctx.hp - dmg
  return { damage: dmg, deflected: false, gateBroken: false, reachedFloor: after <= floor + 1e-9 }
}

/** Local mastery score (GAME_DESIGN 10), maximum 10,000, with grade. */
export function masteryScore(completionSeconds: number, remainingHp: number, fourWay: number, redirects: number) {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  const speed = 3000 * clamp01((285 - completionSeconds) / 165)
  const vitality = Math.max(0, remainingHp) * 30
  const perfect = Math.min(4, fourWay) * 750
  const redirect = Math.min(2, redirects) * 500
  const total = Math.round(speed + vitality + perfect + redirect)
  const grade = total >= 8500 ? 'S' : total >= 7000 ? 'A' : total >= 5000 ? 'B' : 'C'
  return { total, grade, speed: Math.round(speed), vitality, perfect, redirect }
}
