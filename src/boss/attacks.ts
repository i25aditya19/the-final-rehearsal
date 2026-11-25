// Boss attacks for M3: The Gaze (tracking cone that locks, then fires) and Aftershock (two
// expanding ring waves with safe gaps; jumping also clears them). One attack at a time, with
// recovery between them. Visuals are pooled primitives; hit tests are pure (attackMath.ts).
import { Entity, Material, MaterialTransparencyMode, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, ATTACKS, COLORS } from '../config'
import { gapLayout, inCone, ringSweptHits } from '../combat/attackMath'
import { headingDeg, sub, v3 } from '../math/vec'
import { damagePlayer, isActive, state } from '../game/state'
import { watcherEyePosition } from './watcher'
import { setSparks } from '../effects/vfx'
import { onReset } from '../game/session'

type AttackKind = 'gaze' | 'aftershock'
const SEQUENCE: AttackKind[] = ['gaze', 'gaze', 'aftershock']

const center = v3(ARENA.center.x, 0, ARENA.center.z)
const HIDDEN = Vector3.create(0, -30, 0)

// ---------------------------------------------------------------- scheduler state
let current: AttackKind | undefined
let startedAt = 0
let nextAttackAt: number = ATTACKS.firstAttackDelay
let sequenceIndex = 0

// ---------------------------------------------------------------- Gaze state + visuals
let gazePivot: Entity
const gazeParts: Entity[] = []
let gazeHeading = 0
let gazeStage: 'off' | 'track' | 'lock' | 'fire' = 'off'
let gazeFired = false
/** The real beam from the eye: a thin aiming ray while tracking, a sweeping blast on fire. */
let gazeBeam: Entity
let gazeBeamGlow: Entity
const AXIS_FIX = Quaternion.fromEulerDegrees(90, 0, 0)

// ---------------------------------------------------------------- Aftershock state + visuals
const SEGMENTS = 64
const ringSegs: Entity[] = []
const safeLanes: Entity[] = []
let ringLook = ''
type Wave = { warnAt: number; startAt: number; gaps: number[]; done: boolean; hit: boolean; prevRadius: number }
let waves: Wave[] = []

const rgba = (hex: string, a: number) => {
  const c = Color4.fromHexString(hex)
  return Color4.create(c.r, c.g, c.b, a)
}
const rgb = (hex: string) => {
  const c = Color4.fromHexString(hex)
  return Color3.create(c.r, c.g, c.b)
}
function glow(e: Entity, hex: string, alpha: number, intensity: number) {
  Material.setPbrMaterial(e, {
    albedoColor: rgba(hex, alpha),
    emissiveColor: rgb(hex),
    emissiveIntensity: intensity,
    transparencyMode: alpha < 1 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : MaterialTransparencyMode.MTM_AUTO,
    roughness: 1
  })
}

export function initAttacks() {
  // Gaze: a fan of floor rays (each in 3 widening segments) plus two bright edge lines.
  gazePivot = engine.addEntity()
  Transform.create(gazePivot, { position: HIDDEN })
  const g = ATTACKS.gaze
  const rays = 7
  const half = g.coneDeg / 2
  for (let i = 0; i < rays; i++) {
    const deg = -half + (g.coneDeg * (i + 0.5)) / rays
    const arm = engine.addEntity()
    Transform.create(arm, { parent: gazePivot, rotation: Quaternion.fromEulerDegrees(0, deg, 0) })
    const segLen = g.range / 3
    for (let s = 0; s < 3; s++) {
      const far = (s + 1) * segLen
      const width = 2 * far * Math.tan(((g.coneDeg / rays) * Math.PI) / 360) * 1.05
      const e = engine.addEntity()
      Transform.create(e, { parent: arm, position: Vector3.create(0, 0.07 + i * 0.001, s * segLen + segLen / 2), scale: Vector3.create(width, 0.01, segLen) })
      MeshRenderer.setBox(e)
      gazeParts.push(e)
    }
  }
  for (const side of [-1, 1]) {
    const arm = engine.addEntity()
    Transform.create(arm, { parent: gazePivot, rotation: Quaternion.fromEulerDegrees(0, side * half, 0) })
    const e = engine.addEntity()
    Transform.create(e, { parent: arm, position: Vector3.create(0, 0.09, g.range / 2), scale: Vector3.create(0.12, 0.02, g.range) })
    MeshRenderer.setBox(e)
    gazeParts.push(e)
  }

  gazeBeam = engine.addEntity()
  Transform.create(gazeBeam, { position: HIDDEN })
  MeshRenderer.setCylinder(gazeBeam)
  gazeBeamGlow = engine.addEntity()
  Transform.create(gazeBeamGlow, { position: HIDDEN })
  MeshRenderer.setCylinder(gazeBeamGlow)

  // Aftershock: ring of segments repositioned every frame; ivory safe lanes mark the gaps.
  for (let i = 0; i < SEGMENTS; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: HIDDEN })
    MeshRenderer.setBox(e)
    ringSegs.push(e)
  }
  for (let i = 0; i < ATTACKS.aftershock.gapCount; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: HIDDEN })
    MeshRenderer.setBox(e)
    glow(e, COLORS.ivory, 0.35, 1.2)
    safeLanes.push(e)
  }

  engine.addSystem(attackSystem)
  onReset(resetAttacks)
}

function resetAttacks() {
  current = undefined
  nextAttackAt = ATTACKS.firstAttackDelay
  sequenceIndex = 0
  endGaze()
  endAftershock()
}

function playerPos() {
  return Transform.has(engine.PlayerEntity) ? Transform.get(engine.PlayerEntity).position : undefined
}

function attackSystem() {
  if (!isActive()) {
    if (current) {
      current = undefined
      endGaze()
      endAftershock()
    }
    return
  }
  if (!current) {
    if (state.time >= nextAttackAt) startAttack(SEQUENCE[sequenceIndex++ % SEQUENCE.length])
    return
  }
  const finished = current === 'gaze' ? updateGaze() : updateAftershock()
  if (finished) {
    current = undefined
    nextAttackAt = state.time + ATTACKS.recovery
  }
}

function startAttack(kind: AttackKind) {
  current = kind
  startedAt = state.time
  if (kind === 'gaze') {
    gazeFired = false
    gazeStage = 'off'
    const p = playerPos()
    gazeHeading = p ? headingDeg(sub(p, center)) : 180
    Transform.getMutable(gazePivot).position = Vector3.create(center.x, 0, center.z)
  } else {
    const a = ATTACKS.aftershock
    const w1 = state.time + a.warning
    waves = [
      { warnAt: state.time, startAt: w1, gaps: [], done: false, hit: false, prevRadius: a.startRadius },
      { warnAt: w1 + a.repeatDelay - a.warning, startAt: w1 + a.repeatDelay, gaps: [], done: false, hit: false, prevRadius: a.startRadius }
    ]
  }
}

// ---------------------------------------------------------------- Gaze
function setGazeLook(stage: 'track' | 'lock' | 'fire') {
  if (gazeStage === stage) return
  gazeStage = stage
  const alpha = stage === 'track' ? 0.18 : stage === 'lock' ? 0.38 : 0.75
  const intensity = stage === 'track' ? 0.8 : stage === 'lock' ? 1.8 : 5
  gazeParts.forEach((e, i) => {
    const edge = i >= gazeParts.length - 2
    // The floor fan stays readable but secondary to the beam itself.
    glow(e, COLORS.dangerCrimson, (edge ? Math.min(1, alpha + 0.3) : alpha) * 0.7, edge ? intensity * 1.4 : intensity * 0.8)
  })
  glow(gazeBeam, stage === 'fire' ? '#FFD3DA' : COLORS.dangerCrimson, stage === 'fire' ? 0.95 : 0.8, stage === 'fire' ? 9 : stage === 'lock' ? 5 : 3)
  glow(gazeBeamGlow, COLORS.dangerCrimson, stage === 'fire' ? 0.35 : 0.18, stage === 'fire' ? 5 : 2)
}

/** Point the eye beam along a heading, down to the floor at the cone's reach. */
function aimBeam(heading: number, width: number) {
  const eye = watcherEyePosition()
  const g = ATTACKS.gaze
  const rad = (heading * Math.PI) / 180
  const reach = g.range * 0.92
  const end = Vector3.create(center.x + Math.sin(rad) * reach, 0.05, center.z + Math.cos(rad) * reach)
  const dir = Vector3.subtract(end, Vector3.create(eye.x, eye.y, eye.z))
  const len = Vector3.length(dir)
  const rot = Quaternion.multiply(Quaternion.lookRotation(Vector3.normalize(dir)), AXIS_FIX)
  const mid = Vector3.lerp(Vector3.create(eye.x, eye.y, eye.z), end, 0.5)
  const b = Transform.getMutable(gazeBeam)
  b.position = mid
  b.rotation = rot
  b.scale = Vector3.create(width, len, width)
  const gl = Transform.getMutable(gazeBeamGlow)
  gl.position = mid
  gl.rotation = rot
  gl.scale = Vector3.create(width * 3.2, len, width * 3.2)
  return end
}

function updateGaze(): boolean {
  const g = ATTACKS.gaze
  const t = state.time - startedAt
  const p = playerPos()
  const trackEnd = g.warning - g.lockedAim

  if (t < trackEnd) {
    // Track the player briefly (smoothly, never snapping), then lock.
    if (p) {
      const target = headingDeg(sub(p, center))
      let diff = ((target - gazeHeading + 540) % 360) - 180
      gazeHeading = (gazeHeading + diff * 0.15 + 360) % 360
    }
    setGazeLook('track')
    aimBeam(gazeHeading, 0.06 + 0.02 * Math.abs(Math.sin(t * 6)))
  } else if (t < g.warning) {
    setGazeLook('lock')
    aimBeam(gazeHeading, 0.1)
  } else if (t < g.warning + g.flashSeconds) {
    setGazeLook('fire')
    if (!gazeFired) {
      gazeFired = true
      if (p && inCone(p, center, gazeHeading, g.coneDeg, g.range)) damagePlayer(g.damage, 'The Gaze')
    }
    // The blast sweeps across the whole cone, so you see it pass over the floor.
    const k = (t - g.warning) / g.flashSeconds
    const sweep = gazeHeading + (k * 2 - 1) * (g.coneDeg / 2)
    const ground = aimBeam(sweep, 0.55)
    setSparks({ x: ground.x, y: ground.y, z: ground.z })
  } else {
    endGaze()
    return true
  }
  Transform.getMutable(gazePivot).rotation = Quaternion.fromEulerDegrees(0, gazeHeading, 0)
  return false
}

function endGaze() {
  gazeStage = 'off'
  if (gazePivot) Transform.getMutable(gazePivot).position = HIDDEN
  if (gazeBeam) {
    Transform.getMutable(gazeBeam).position = HIDDEN
    Transform.getMutable(gazeBeamGlow).position = HIDDEN
  }
  setSparks(undefined)
}

// ---------------------------------------------------------------- Aftershock
function setRingLook(look: 'warn' | 'wave') {
  if (ringLook === look) return
  ringLook = look
  for (const e of ringSegs) glow(e, COLORS.dangerCrimson, look === 'warn' ? 0.45 : 0.85, look === 'warn' ? 1.5 : 3.5)
}

function updateAftershock(): boolean {
  const a = ATTACKS.aftershock
  const p = playerPos()
  const maxRadius = ARENA.playableRadius + a.bandWidth
  let active: { wave: Wave; radius: number; warning: boolean } | undefined

  for (const w of waves) {
    if (w.done || state.time < w.warnAt) continue
    if (w.gaps.length === 0) {
      // Gaps are chosen when the warning appears, near the player so they are reachable.
      const ph = p ? headingDeg(sub(p, center)) : 0
      w.gaps = gapLayout(ph, a.gapCount, (w === waves[0] ? 1 : -1) * (a.gapDeg * 0.9))
    }
    if (state.time < w.startAt) {
      active = { wave: w, radius: a.startRadius, warning: true }
    } else {
      const radius = a.startRadius + (state.time - w.startAt) * a.speed
      if (radius > maxRadius) {
        w.done = true
        continue
      }
      if (!w.hit && p) {
        const hit = ringSweptHits(p, { center, radius, bandWidth: a.bandWidth, gapCenters: w.gaps, gapDeg: a.gapDeg, jumpClear: a.jumpClear }, w.prevRadius)
        if (hit) {
          w.hit = true // one hit per wave
          damagePlayer(a.damage, 'Aftershock')
        }
      }
      w.prevRadius = radius
      active = { wave: w, radius, warning: false }
    }
    break
  }

  if (!active) {
    hideRing()
    if (waves.every((w) => w.done)) {
      endAftershock()
      return true
    }
    return false
  }

  // Draw the ring: segments skip the gaps; during warning it pulses at the dais edge.
  setRingLook(active.warning ? 'warn' : 'wave')
  const r = active.radius
  const pulse = active.warning ? 0.6 + 0.4 * Math.abs(Math.sin((state.time - active.wave.warnAt) * 9)) : 1
  const segLen = ((2 * Math.PI * r) / SEGMENTS) * 1.04
  for (let i = 0; i < SEGMENTS; i++) {
    const deg = (i + 0.5) * (360 / SEGMENTS)
    const inGapNow = active.wave.gaps.some((g) => Math.abs(((deg - g + 540) % 360) - 180) <= a.gapDeg / 2)
    const tr = Transform.getMutable(ringSegs[i])
    if (inGapNow) {
      tr.position = HIDDEN
      continue
    }
    const rad = (deg * Math.PI) / 180
    tr.position = Vector3.create(center.x + Math.sin(rad) * r, 0.22 * pulse, center.z + Math.cos(rad) * r)
    tr.rotation = Quaternion.fromEulerDegrees(0, deg + 90, 0)
    tr.scale = Vector3.create(segLen, 0.44 * pulse, a.bandWidth * 0.55)
  }
  // Safe lanes: ivory strips along each gap, from the dais to the wall.
  active.wave.gaps.forEach((g, i) => {
    const lane = safeLanes[i]
    if (!lane) return
    const rad = (g * Math.PI) / 180
    const len = ARENA.playableRadius - a.startRadius
    const mid = a.startRadius + len / 2
    const tr = Transform.getMutable(lane)
    tr.position = Vector3.create(center.x + Math.sin(rad) * mid, 0.08, center.z + Math.cos(rad) * mid)
    tr.rotation = Quaternion.fromEulerDegrees(0, g, 0)
    tr.scale = Vector3.create(1.2, 0.01, len)
  })
  return false
}

function hideRing() {
  for (const e of ringSegs) Transform.getMutable(e).position = HIDDEN
  for (const e of safeLanes) Transform.getMutable(e).position = HIDDEN
}

function endAftershock() {
  waves = []
  if (ringSegs.length) hideRing()
}

/** For the HUD: name of the attack currently telegraphed, if any. */
export function currentAttack(): AttackKind | undefined {
  return current
}
