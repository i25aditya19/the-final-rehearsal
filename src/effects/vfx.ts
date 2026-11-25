// Particle effects within the Decentraland budget (8 emitters, <= 1000 live particles):
//   4 spell-trail emitters, 1 impact emitter, 1 Watcher shadow aura, 1 Gaze spark emitter,
//   1 ambient mote field. Emitters are reused; "bursts" are short pulses of emission rate.
import {
  Entity,
  PBParticleSystem_BlendMode,
  PBParticleSystem_SimulationSpace,
  ParticleSystem,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { ARENA } from '../config'
import { state } from '../game/state'
import { onReset } from '../game/session'
import { V3 } from '../math/vec'

export const GLOW = 'assets/images/glow.png'
export const SPARK = 'assets/images/spark.png'
const HIDDEN = Vector3.create(0, -40, 0)

const hexA = (hex: string, a: number) => {
  const c = Color4.fromHexString(hex)
  return Color4.create(c.r, c.g, c.b, a)
}

// ------------------------------------------------------------------ spell trails
const TRAILS = 4
const trails: { entity: Entity; color: string; owner: number }[] = []
let trailCursor = 0

// ------------------------------------------------------------------ impacts
let impact: Entity
let impactUntil = 0

// ------------------------------------------------------------------ gaze sparks
let sparks: Entity

export function initVfx() {
  for (let i = 0; i < TRAILS; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: HIDDEN })
    ParticleSystem.create(e, {
      rate: 0,
      lifetime: 0.4,
      maxParticles: 60,
      initialSize: { start: 0.22, end: 0.38 },
      sizeOverTime: { start: 1, end: 0 },
      initialVelocitySpeed: { start: 0.1, end: 0.6 },
      blendMode: PBParticleSystem_BlendMode.PSB_ADD,
      simulationSpace: PBParticleSystem_SimulationSpace.PSS_WORLD,
      shape: ParticleSystem.Shape.Sphere({ radius: 0.08 }),
      texture: { src: GLOW }
    })
    trails.push({ entity: e, color: '', owner: -1 })
  }

  impact = engine.addEntity()
  Transform.create(impact, { position: HIDDEN })
  ParticleSystem.create(impact, {
    rate: 0,
    lifetime: 0.55,
    maxParticles: 120,
    initialSize: { start: 0.25, end: 0.6 },
    sizeOverTime: { start: 1, end: 0 },
    initialVelocitySpeed: { start: 3, end: 7 },
    limitVelocity: { speed: 2, dampen: 0.5 },
    blendMode: PBParticleSystem_BlendMode.PSB_ADD,
    simulationSpace: PBParticleSystem_SimulationSpace.PSS_WORLD,
    shape: ParticleSystem.Shape.Sphere({ radius: 0.25 }),
    texture: { src: SPARK }
  })

  sparks = engine.addEntity()
  Transform.create(sparks, { position: HIDDEN })
  ParticleSystem.create(sparks, {
    rate: 0,
    lifetime: 0.5,
    maxParticles: 80,
    initialSize: { start: 0.2, end: 0.45 },
    sizeOverTime: { start: 1, end: 0 },
    initialVelocitySpeed: { start: 2, end: 5 },
    gravity: 0.6,
    initialColor: { start: hexA('#FF4A64', 1), end: hexA('#C5223F', 1) },
    colorOverTime: { start: hexA('#FF6A7F', 1), end: hexA('#C5223F', 0) },
    blendMode: PBParticleSystem_BlendMode.PSB_ADD,
    simulationSpace: PBParticleSystem_SimulationSpace.PSS_WORLD,
    shape: ParticleSystem.Shape.Cone({ angle: 55, radius: 0.3 }),
    texture: { src: SPARK }
  })

  // Faint silver motes drifting through the chamber (atmosphere; colour stays neutral).
  const motes = engine.addEntity()
  Transform.create(motes, { position: Vector3.create(ARENA.center.x, 4, ARENA.center.z) })
  ParticleSystem.create(motes, {
    rate: 18,
    lifetime: 9,
    maxParticles: 170,
    prewarm: true,
    initialSize: { start: 0.06, end: 0.14 },
    initialVelocitySpeed: { start: 0.05, end: 0.25 },
    additionalForce: Vector3.create(0.05, 0.08, 0.02),
    initialColor: { start: hexA('#D4D4D4', 0.5), end: hexA('#969696', 0.35) },
    colorOverTime: { start: hexA('#F1EFEA', 0.45), end: hexA('#969696', 0) },
    blendMode: PBParticleSystem_BlendMode.PSB_ADD,
    shape: ParticleSystem.Shape.Box({ size: Vector3.create(ARENA.playableRadius * 2, 7, ARENA.playableRadius * 2) }),
    texture: { src: GLOW }
  })

  engine.addSystem(vfxSystem)
  onReset(() => {
    for (const t of trails) releaseTrail(t.owner)
    stopSparks()
  })
}

/** Shadow wisps rising off the Watcher's robes (parented to the boss root). */
export function attachBossAura(parent: Entity) {
  const e = engine.addEntity()
  Transform.create(e, { parent, position: Vector3.create(0, -2.2, 0) })
  ParticleSystem.create(e, {
    rate: 26,
    lifetime: 2.6,
    maxParticles: 90,
    initialSize: { start: 0.6, end: 1.3 },
    sizeOverTime: { start: 0.6, end: 1.4 },
    initialVelocitySpeed: { start: 0.2, end: 0.7 },
    gravity: -0.08,
    initialColor: { start: hexA('#0B0B0B', 0.55), end: hexA('#242424', 0.45) },
    colorOverTime: { start: hexA('#242424', 0.5), end: hexA('#0B0B0B', 0) },
    blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
    simulationSpace: PBParticleSystem_SimulationSpace.PSS_WORLD,
    shape: ParticleSystem.Shape.Sphere({ radius: 1.4 }),
    texture: { src: GLOW }
  })
}

/** Claim a trail emitter for a projectile (round-robin; oldest trail is taken over). */
export function claimTrail(owner: number, colorHex: string, pos: V3): number {
  const idx = trailCursor++ % TRAILS
  const t = trails[idx]
  t.owner = owner
  Transform.getMutable(t.entity).position = Vector3.create(pos.x, pos.y, pos.z)
  const ps = ParticleSystem.getMutable(t.entity)
  if (t.color !== colorHex) {
    ps.initialColor = { start: hexA(colorHex, 0.9), end: hexA('#FFFFFF', 0.8) }
    ps.colorOverTime = { start: hexA(colorHex, 0.85), end: hexA(colorHex, 0) }
    t.color = colorHex
  }
  ps.rate = 90
  return idx
}

export function moveTrail(owner: number, idx: number, pos: V3) {
  const t = trails[idx]
  if (!t || t.owner !== owner) return
  Transform.getMutable(t.entity).position = Vector3.create(pos.x, pos.y, pos.z)
}

export function releaseTrail(owner: number) {
  for (const t of trails) {
    if (t.owner !== owner || owner < 0) continue
    t.owner = -1
    ParticleSystem.getMutable(t.entity).rate = 0
  }
}

/** Short burst of sparks at a point (spell impact, fizzle, Convergence). */
export function burst(pos: V3, colorHex: string, strength = 1) {
  Transform.getMutable(impact).position = Vector3.create(pos.x, pos.y, pos.z)
  const ps = ParticleSystem.getMutable(impact)
  ps.initialColor = { start: hexA(colorHex, 1), end: hexA('#FFFFFF', 1) }
  ps.colorOverTime = { start: hexA(colorHex, 1), end: hexA(colorHex, 0) }
  ps.initialSize = { start: 0.25 * strength, end: 0.6 * strength }
  ps.rate = 380 * strength
  impactUntil = state.time + 0.06
}

/** Crimson sparks where the Gaze beam meets the floor. */
export function setSparks(pos: V3 | undefined) {
  if (!pos) return stopSparks()
  Transform.getMutable(sparks).position = Vector3.create(pos.x, pos.y + 0.1, pos.z)
  ParticleSystem.getMutable(sparks).rate = 140
}

function stopSparks() {
  if (!sparks) return
  ParticleSystem.getMutable(sparks).rate = 0
}

function vfxSystem() {
  if (impactUntil > 0 && state.time > impactUntil) {
    ParticleSystem.getMutable(impact).rate = 0
    impactUntil = 0
  }
}
