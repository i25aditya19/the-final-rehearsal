// Runtime phase manager: routes all boss damage through the pure rules, raises gates at the
// phase floors, runs transitions (pause, heal, transformation) and draws the barrier.
import { Entity, Material, MaterialTransparencyMode, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { autoCull } from '../effects/visibility'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import { ARENA, ATTACKS, BOSS, COLORS, PHASES, PLAYER, SESSION } from '../config'
import { sectorOf } from '../combat/aim'
import { BossCtx, Convergence, DamageKind, DamageOutcome, resolveBossDamage } from './phaseRules'
import { isActive, say, speak, state, falseVictory } from './state'
import { onReset } from './session'
import { setVisage } from '../boss/watcher'
import { finalSectors, gateSectors } from './assist'
import { burst } from '../effects/vfx'
import { onSealBroken, startFinaleInterference } from '../boss/attacks'
import { spawnTracer } from '../effects/tracers'

const rules = () => ({
  phaseHealth: BOSS.phaseHealth,
  phase2OrdinaryMultiplier: PHASES.phase2OrdinaryMultiplier,
  phase2GateSectors: gateSectors(),
  phase3MinSectors: finalSectors(),
  phase3MinEchoes: state.assist ? 2 : 3,
  phase3SealDamage: PHASES.phase3SealDamage
})

let barrier: Entity
let barrierLook = ''

export function bossCtx(): BossCtx {
  return {
    phase: state.bossPhase,
    stage: state.stage,
    hp: state.bossHp,
    vulnerable: state.time < state.vulnerableUntil,
    windowOpen: state.time < state.windowOpenUntil
  }
}

/** The single entry point for damaging The Watcher. */
export function hitBoss(kind: DamageKind, amount: number, conv?: Convergence, at?: { x: number; y: number; z: number }, origin?: { x: number; z: number }): DamageOutcome {
  if (!isActive()) return { damage: 0, deflected: false, gateBroken: false, reachedFloor: false }
  const ctx = bossCtx()
  // Blind Spot: magic cast from the exposed quadrant strikes harder (rewards echoes placed there).
  const fromBlind = ctx.vulnerable && origin && (kind === 'direct' || kind === 'echo') && sectorOf({ x: origin.x, y: 0, z: origin.z }, ARENA.center, 4) === state.blindSector
  if (fromBlind) amount *= ATTACKS.blindSpot.exposedBonus
  const out = resolveBossDamage(ctx, kind, amount, rules(), conv)
  if (out.damage > 0 && fromBlind) state.blindHits++
  if (out.deflected) {
    state.deflectAt = state.time
    if (at) burst(at, COLORS.ash, 0.5)
  }
  if (out.damage > 0) {
    state.bossHp = Math.max(0, state.bossHp - out.damage)
    state.bossFlashUntil = state.time + 0.12
    state.phaseProgressAt = state.time
  }
  if (out.reachedFloor && state.bossPhase < 3) enterGate()
  if (out.gateBroken) startTransition()
  if (out.seal && !out.finale) breakSeal(!!conv && conv.hits >= 4 && conv.sectors >= 4)
  if (out.finale) startFinale()
  return out
}

function enterGate() {
  state.stage = 'gate'
  state.stageStartedAt = state.time
  state.phaseProgressAt = state.time
  if (state.bossPhase === 1) say('A barrier rises. Converge two echoes (E) to break it.', 4)
  else say('The barrier hardens. Converge three echoes from three different sides.', 4.5)
}

function startTransition() {
  state.stage = 'transition'
  state.stageStartedAt = state.time
  burst({ x: ARENA.center.x, y: BOSS.hoverHeight, z: ARENA.center.z }, COLORS.syncGold, 2)
  if (state.bossPhase === 2) say('THE WATCHER FALLS STILL...', 2.6)
}

function finishTransition() {
  state.bossPhase = (state.bossPhase + 1) as 2 | 3
  state.stage = 'fight'
  state.stageStartedAt = state.time
  state.phaseProgressAt = state.time
  state.playerHp = Math.min(PLAYER.maxVitality, state.playerHp + PLAYER.healPerPhase)
  if (state.bossPhase === 2) {
    say('PHASE II  ·  THE INTERFERENCE', 3)
  } else {
    setVisage('mask')
    speak('final', 'I WILL NOT LOOK AWAY.', 4)
    say('PHASE III  ·  THE ALL-SEEING  ·  only a three-sided Convergence can pierce his sight', 4.5)
  }
}

export function initPhases() {
  // Barrier: a translucent shell around the Watcher (gates and the phase III shield).
  barrier = engine.addEntity()
  Transform.create(barrier, { position: Vector3.create(ARENA.center.x, BOSS.hoverHeight, ARENA.center.z), scale: Vector3.Zero() })
  MeshRenderer.setSphere(barrier)
  autoCull(barrier)
  engine.addSystem(phaseSystem)
  onReset(() => {
    barrierLook = ''
    Transform.getMutable(barrier).scale = Vector3.Zero()
  })
}

function setBarrier(look: 'off' | 'gate' | 'shield' | 'open', pulse: number) {
  const tr = Transform.getMutable(barrier)
  if (look === 'off') {
    tr.scale = Vector3.Zero()
    barrierLook = 'off'
    return
  }
  const r = (BOSS.hitRadius + 0.8) * 2 * (1 + pulse * 0.03)
  tr.scale = Vector3.create(r, BOSS.hitHeight + 1, r)
  if (barrierLook === look) return
  barrierLook = look
  const hex = look === 'open' ? COLORS.syncGold : look === 'shield' ? COLORS.finalWhite : COLORS.ash
  const c = Color4.fromHexString(hex)
  Material.setPbrMaterial(barrier, {
    albedoColor: Color4.create(c.r, c.g, c.b, look === 'open' ? 0.08 : 0.16),
    emissiveColor: Color3.create(c.r, c.g, c.b),
    emissiveIntensity: look === 'open' ? 1.2 : 0.7,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    roughness: 1
  })
}

// Phase III seals. A: his observation breaks. B: his control breaks (desperate). C: the finale.
function breakSeal(perfect: boolean) {
  state.seals++
  burst({ x: ARENA.center.x, y: BOSS.hoverHeight + 1.5, z: ARENA.center.z }, COLORS.syncGold, 2.2)
  if (state.seals === 1) {
    say(perfect ? 'HIS OBSERVATION SHATTERS  ·  two seals remain  ·  his sight reopens at once' : 'HIS OBSERVATION BREAKS  ·  two seals remain', 3.5)
    speak('seal1', 'You... see me?', 2.5)
  } else {
    say(perfect ? 'HIS CONTROL SHATTERS  ·  one seal remains' : 'HIS CONTROL BREAKS  ·  one seal remains  ·  he grows desperate', 3.5)
    speak('seal2', 'Stop... rewriting... me...', 3)
  }
  onSealBroken(perfect)
}

function startFinale() {
  state.seals = 3
  state.stage = 'finale'
  state.finaleAt = state.time
  state.finaleHit = false
  // Capture the formation that earned the finale (it fires the finishing attack).
  const ids = state.convergingIds
  const formation = state.echoes.filter((e) => ids.includes(e.id) && !e.corrupted)
  state.finalFormation = formation.map((e) => ({ x: e.pos.x, z: e.pos.z }))
  // The echoes hold their charge until the finishing attack.
  for (const e of state.echoes) e.nextFire = state.time + PHASES.finaleFinishAt + 1
  say('THE FINAL REHEARSAL  ·  survive his last resistance  ·  your echoes are charging', 3.5)
  speak('resist', 'No... not this moment...', 2.5)
  startFinaleInterference()
}

function updateFinale() {
  const t = state.time - state.finaleAt
  if (t >= PHASES.finaleFinishAt) {
    // The finishing attack: every echo of the formation fires into him from where it stands.
    const boss = { x: ARENA.center.x, y: BOSS.hoverHeight + 0.6, z: ARENA.center.z }
    for (const p of state.finalFormation) spawnTracer({ x: p.x, y: 1.4, z: p.z }, boss, COLORS.syncGold, false, { width: 0.35, seconds: 1.4, intensity: 9 })
    burst(boss, COLORS.syncGold, 3)
    if (!state.finaleHit) say('MOMENT EVADED  ·  FLAWLESS FINALE', 2.5)
    state.bossFlashUntil = state.time + 0.3
    state.bossHp = 0 // the session ends the run as a victory on its next tick
  }
}

function phaseSystem(dt: number) {
  if (!isActive()) return setBarrier('off', 0)
  const pulse = Math.sin(state.time * 3)
  if (state.stage === 'finale') {
    setBarrier('off', 0)
    return updateFinale()
  }
  if (state.stage === 'transition') {
    // Pause the formation's beat so echoes resume in step afterwards.
    for (const e of state.echoes) e.nextFire += Math.min(dt, SESSION.maxFrameDt)
    setBarrier('off', 0)
    const fv = falseVictory()
    if (fv && fv.e >= 2.85) speak('firsttime', 'Did you really believe this was the first time?', 3.2)
    if (state.time - state.stageStartedAt >= (state.bossPhase === 2 ? SESSION.finalTransitionSeconds : SESSION.transitionSeconds)) finishTransition()
    return
  }
  if (state.stage === 'gate') {
    setBarrier('gate', pulse)
    // Contextual hint if the player is stuck at the gate.
    if (state.time - state.phaseProgressAt > PHASES.stallHintSeconds) {
      state.phaseProgressAt = state.time
      if (state.bossPhase === 1) say('Place echoes in two spots, wait for gold runes, then press E.', 4)
      else say('Stand in three different quadrants (N/E/S/W runes) and cast from each, then press E.', 4.5)
    }
    return
  }
  if (state.bossPhase === 3) setBarrier(state.time < state.windowOpenUntil ? 'open' : 'shield', pulse)
  else setBarrier('off', 0)
}

/** Text for the HUD objective line. */
export function objectiveText(): string {
  if (state.stage === 'transition') return 'Time folds...'
  if (state.stage === 'gate') return state.bossPhase === 1 ? 'Break the barrier: Convergence with 2 echoes' : 'Break the barrier: Convergence with 3 echoes from 3 sides'
  if (state.bossPhase === 1) return 'Wear him down with spells and echoes'
  if (state.bossPhase === 2) return state.time < state.vulnerableUntil ? 'He is blind: strike now!' : 'Spells are weak now: use Convergence or the Blind Spot'
  return state.time < state.windowOpenUntil ? 'His sight is open: Convergence from 3+ sides!' : 'Survive the Observation, then converge from 3+ sides'
}
