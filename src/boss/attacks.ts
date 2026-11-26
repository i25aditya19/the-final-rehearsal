// Boss attacks for M3: The Gaze (tracking cone that locks, then fires) and Aftershock (two
// expanding ring waves with safe gaps; jumping also clears them). One attack at a time, with
// recovery between them. Visuals are pooled primitives; hit tests are pure (attackMath.ts).
import { Entity, GltfContainer, Material, MaterialTransparencyMode, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, ATTACKS, COLORS } from '../config'
import { gapLayout, inCone, ringSweptHits } from '../combat/attackMath'
import { distXZ, headingDeg, sub, v3 } from '../math/vec'
import { damagePlayer, isActive, say, state } from '../game/state'
import { corruptionReady, startCorruption, updateCorruption } from './corruption'
import { withWarn } from '../game/assist'
import { autoCull, setShown } from '../effects/visibility'
import { pointSegmentDistance, sectorOf } from '../combat/aim'
import { watcherEyePosition } from './watcher'
import { setSparks } from '../effects/vfx'
import { onReset } from '../game/session'

type AttackKind = 'gaze' | 'aftershock' | 'stolen' | 'blindspot' | 'observation' | 'volley'
/** Attack order per phase (GAME_DESIGN 7.4 / 8). Phase I introduces Gaze then Aftershock. */
const SEQUENCES: Record<1 | 2 | 3, AttackKind[]> = {
  1: ['gaze', 'gaze', 'aftershock'],
  2: ['stolen', 'gaze', 'blindspot', 'volley', 'aftershock', 'gaze', 'blindspot', 'volley'],
  3: ['observation', 'volley', 'observation', 'stolen', 'observation', 'gaze', 'volley']
}
/** At a gate only the basic attacks run, so the teaching moment stays readable. */
const GATE_ALLOWED: AttackKind[] = ['gaze', 'aftershock']
let sequencePhase = 1

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

/** Smooth telegraph model (assets/telegraphs, unit radius) with no colliders. */
const TELE = 'assets/telegraphs/'
function tele(file: string, parent?: Entity, y = 0.08): Entity {
  const e = engine.addEntity()
  Transform.create(e, { parent, position: parent ? Vector3.create(0, y, 0) : HIDDEN, scale: Vector3.Zero() })
  GltfContainer.create(e, { src: TELE + file, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  return e
}
const show = (e: Entity, sx: number, sy: number, sz: number) => {
  Transform.getMutable(e).scale = Vector3.create(sx, sy, sz)
  setShown(e, true)
}
const hide = (e: Entity) => {
  Transform.getMutable(e).scale = Vector3.Zero()
  setShown(e, false)
}

export function initAttacks() {
  // Gaze: a fan of floor rays (each in 3 widening segments) plus two bright edge lines.
  gazePivot = engine.addEntity()
  Transform.create(gazePivot, { position: HIDDEN })
  // Gaze floor cone: smooth soft-gradient wedge (tracking) and a hot one (locked / firing).
  gazeParts.push(tele('wedge34_soft.glb', gazePivot), tele('wedge34_hot.glb', gazePivot, 0.09))

  // Eye beam: thin where it leaves the eye, wider where it lands (cylinder bottom = eye end).
  gazeBeam = engine.addEntity()
  Transform.create(gazeBeam, { position: HIDDEN })
  MeshRenderer.setCylinder(gazeBeam, 0.22, 0.5)
  gazeBeamGlow = engine.addEntity()
  Transform.create(gazeBeamGlow, { position: HIDDEN })
  MeshRenderer.setCylinder(gazeBeamGlow, 0.18, 0.5)

  // Aftershock: one smooth glowing wave band (two arcs; the gaps are built into the model at
  // 0 and 180 degrees and the band is turned to the chosen gaps); ivory lanes mark the gaps.
  ringSegs.push(tele('wave_band.glb'))
  for (let i = 0; i < ATTACKS.aftershock.gapCount; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: HIDDEN })
    MeshRenderer.setBox(e)
    glow(e, COLORS.ivory, 0.35, 1.2)
    safeLanes.push(e)
  }

  autoCull(gazeBeam, gazeBeamGlow, ...safeLanes)
  engine.addSystem(attackSystem)
  onReset(resetAttacks)
}

function resetAttacks() {
  cancelCurrent()
  sequencePhase = 1
  current = undefined
  nextAttackAt = ATTACKS.firstAttackDelay
  sequenceIndex = 0
  endGaze()
  endAftershock()
}

function playerPos() {
  return Transform.has(engine.PlayerEntity) ? Transform.get(engine.PlayerEntity).position : undefined
}

function cancelCurrent() {
  state.bossCasting = undefined
  if (!current) return
  current = undefined
  endVolley()
  endGaze()
  endAftershock()
  endBlindSpot()
  endObservation()
}

function nextKind(): AttackKind | undefined {
  const phase = state.bossPhase
  if (sequencePhase !== phase) {
    sequencePhase = phase
    sequenceIndex = 0
  }
  const seq = SEQUENCES[phase]
  // Variation: after the first pass the order is reshuffled (the first attack stays first), so
  // repeated runs differ without unfair surprises.
  if (sequenceIndex > 0 && sequenceIndex % seq.length === 0) {
    for (let i = seq.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * i)
      const tmp = seq[i]
      seq[i] = seq[j]
      seq[j] = tmp
    }
  }
  for (let tries = 0; tries < seq.length; tries++) {
    const kind = seq[sequenceIndex++ % seq.length]
    if (state.stage === 'gate' && !GATE_ALLOWED.includes(kind)) continue
    if (kind === 'stolen' && !corruptionReady()) continue
    return kind
  }
  return 'gaze'
}

function attackSystem() {
  if (!isActive() || state.stage === 'transition') {
    if (current) cancelCurrent()
    if (state.stage === 'transition') nextAttackAt = Math.max(nextAttackAt, state.time + 2.5)
    return
  }
  if (!current) {
    if (state.time >= nextAttackAt) {
      const k = nextKind()
      if (k) startAttack(k)
    }
    return
  }
  const finished =
    current === 'gaze' ? updateGaze()
    : current === 'aftershock' ? updateAftershock()
    : current === 'stolen' ? updateCorruption()
    : current === 'blindspot' ? updateBlindSpot()
    : current === 'volley' ? updateVolley()
    : updateObservation()
  if (finished) {
    current = undefined
    state.bossCasting = undefined
    nextAttackAt = state.time + (state.stage === 'gate' ? ATTACKS.recovery * 1.6 : ATTACKS.recovery)
  }
}

function startAttack(kind: AttackKind) {
  current = kind
  startedAt = state.time
  state.bossCasting = kind
  state.bossCastAt = state.time
  if (kind === 'stolen') {
    if (!startCorruption()) current = undefined
    return
  }
  if (kind === 'blindspot') return startBlindSpot()
  if (kind === 'observation') return startObservation()
  if (kind === 'volley') return startVolley()
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
  const R = ATTACKS.gaze.range
  if (stage === 'track') {
    show(gazeParts[0], R, 1, R)
    hide(gazeParts[1])
  } else {
    hide(gazeParts[0])
    show(gazeParts[1], R, 1, R)
  }
  void alpha
  void intensity
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
  const g = withWarn(ATTACKS.gaze)
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
  ringLook = look
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
  const band = Transform.getMutable(ringSegs[0])
  band.position = Vector3.create(center.x, 0.055, center.z)
  band.rotation = Quaternion.fromEulerDegrees(0, active.wave.gaps[0] ?? 0, 0)
  band.scale = Vector3.create(r, (active.warning ? 0.5 : 0.85) * pulse, r)
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
  for (const e of ringSegs) hide(e)
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

// ---------------------------------------------------------------- Blind Spot (phase II)
const quadrants: { pivot: Entity; parts: Entity[]; look: string }[] = []
let safeQuadrant = 0
let blindPulsed = false
let blindBuilt = false

function ensureBlindSpot() {
  if (blindBuilt) return
  blindBuilt = true
  for (let q = 0; q < 4; q++) {
    const pivot = engine.addEntity()
    Transform.create(pivot, { position: HIDDEN, rotation: Quaternion.fromEulerDegrees(0, q * 90, 0) })
    const parts = [tele('wedge88_crimson.glb', pivot), tele('wedge88_ivory.glb', pivot, 0.085), tele('wedge88_gold.glb', pivot, 0.09)]
    quadrants.push({ pivot, parts, look: '' })
  }
}

function quadLook(q: number, look: 'danger' | 'safe' | 'blast' | 'blind') {
  const Q = quadrants[q]
  if (Q.look === look) return
  Q.look = look
  const R = ARENA.playableRadius
  const which = look === 'safe' ? 1 : look === 'blind' ? 2 : 0
  Q.parts.forEach((e, k) => (k === which ? show(e, R, look === 'blast' ? 1.6 : 1, R) : hide(e)))
}

function startBlindSpot() {
  ensureBlindSpot()
  blindPulsed = false
  // Safe quadrant: the neighbour whose boundary the player is closest to (always reachable).
  const p = playerPos()
  const ph = p ? headingDeg(sub(p, center)) : 0
  const mine = sectorOf(p ?? center, center, 4)
  const offset = ((ph - mine * 90 + 540) % 360) - 180
  safeQuadrant = (mine + (offset >= 0 ? 1 : 3)) % 4
  for (let q = 0; q < 4; q++) {
    Transform.getMutable(quadrants[q].pivot).position = Vector3.create(center.x, 0, center.z)
    quadLook(q, q === safeQuadrant ? 'safe' : 'danger')
  }
  say(`THE BLIND SPOT  ·  run to the pale quadrant (${['north', 'east', 'south', 'west'][safeQuadrant]})`, ATTACKS.blindSpot.warning)
}

function updateBlindSpot(): boolean {
  const b = withWarn(ATTACKS.blindSpot)
  const t = state.time - startedAt
  if (t >= b.warning && !blindPulsed) {
    blindPulsed = true
    const p = playerPos()
    const inSafe = p ? sectorOf(p, center, 4, 6, safeQuadrant) === safeQuadrant || distXZ(p, center) < ARENA.daisRadius : true
    if (!inSafe) damagePlayer(b.damage, 'the Blind Spot')
    for (let q = 0; q < 4; q++) quadLook(q, q === safeQuadrant ? 'blind' : 'blast')
    state.vulnerableUntil = state.time + b.vulnerability
    say('HE CANNOT SEE YOU  ·  strike from the blind spot!', 2.5)
  }
  if (t >= b.warning + 0.35) for (let q = 0; q < 4; q++) if (q !== safeQuadrant) Transform.getMutable(quadrants[q].pivot).position = HIDDEN
  if (t >= b.warning + b.vulnerability) {
    endBlindSpot()
    return true
  }
  return false
}

function endBlindSpot() {
  for (const Q of quadrants) Transform.getMutable(Q.pivot).position = HIDDEN
}

// ---------------------------------------------------------------- Final Observation (phase III)
let obsDanger: Entity | undefined
const obsSafe: Entity[] = []
let obsPulsed = false
let obsLook = ''

function ensureObservation() {
  if (obsDanger) return
  obsDanger = tele('disc_crimson.glb')
  for (let i = 0; i < 4; i++) obsSafe.push(tele('disc_ivory.glb'))
}

function safeCenters(): { x: number; z: number }[] {
  const f = ATTACKS.finalObservation
  const r = ARENA.playableRadius * f.safeRingFraction
  return [0, 90, 180, 270].map((d) => ({ x: center.x + Math.sin((d * Math.PI) / 180) * r, z: center.z + Math.cos((d * Math.PI) / 180) * r }))
}

function startObservation() {
  ensureObservation()
  obsPulsed = false
  obsLook = ''
  const f = ATTACKS.finalObservation
  const R = ARENA.playableRadius
  const tr = Transform.getMutable(obsDanger!)
  tr.position = Vector3.create(center.x, 0.08, center.z)
  tr.scale = Vector3.create(R, 1, R)
  safeCenters().forEach((c, i) => {
    const s = Transform.getMutable(obsSafe[i])
    s.position = Vector3.create(c.x, 0.1, c.z)
    s.scale = Vector3.create(f.safeRadius, 1, f.safeRadius)
  })
  say('THE FINAL OBSERVATION  ·  stand in a pale circle', f.warning)
}

function setObsLook(look: 'warn' | 'blast') {
  if (obsLook === look || !obsDanger) return
  obsLook = look
  // Blast: the danger floor flares (lifted slightly so it reads as a pulse).
  Transform.getMutable(obsDanger).position = Vector3.create(center.x, look === 'blast' ? 0.25 : 0.08, center.z)
}

function updateObservation(): boolean {
  const f = withWarn(ATTACKS.finalObservation)
  const t = state.time - startedAt
  if (t < f.warning) {
    setObsLook('warn')
    return false
  }
  if (!obsPulsed) {
    obsPulsed = true
    setObsLook('blast')
    const p = playerPos()
    const safe = p ? safeCenters().some((c) => Math.hypot(p.x - c.x, p.z - c.z) <= f.safeRadius + 0.3) : true
    if (!safe) damagePlayer(f.pulseDamage, 'the Final Observation')
    state.windowOpenUntil = state.time + f.openWindow
    say('HIS SIGHT IS OPEN  ·  Convergence from three sides, now!', 3)
  }
  if (t >= f.warning + 0.4) {
    if (obsDanger) hide(obsDanger)
    for (const e of obsSafe) hide(e)
  }
  if (t >= f.warning + f.openWindow + f.rest) {
    endObservation()
    return true
  }
  return false
}

function endObservation() {
  if (obsDanger) hide(obsDanger)
  for (const e of obsSafe) hide(e)
}

/** Read-only snapshot of what the floor telegraphs show (for the headless playtest bot in sim/). */
export function attackDebug() {
  return {
    kind: current,
    startedAt,
    gazeHeading,
    gazeStage,
    waves: waves.map((w) => ({ warnAt: w.warnAt, startAt: w.startAt, gaps: w.gaps, done: w.done })),
    safeQuadrant,
    safeCircles: current === 'observation' ? safeCenters() : []
  }
}

// ---------------------------------------------------------------- Archive Volley (phases II-III)
type Bolt = { e: Entity; active: boolean; x: number; z: number; dx: number; dz: number; px: number; pz: number }
const bolts: Bolt[] = []
let volleyWarn: Entity | undefined
let volleyWave = 0
let volleyHit = false

function ensureVolley() {
  if (bolts.length) return
  const v = ATTACKS.volley
  for (let i = 0; i < v.waves * v.boltsPerWave; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: HIDDEN, scale: Vector3.create(0.42, 0.42, 0.42) })
    GltfContainer.create(e, { src: 'assets/fx/orb_crimson.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
    setShown(e, false)
    bolts.push({ e, active: false, x: 0, z: 0, dx: 0, dz: 0, px: 0, pz: 0 })
  }
  volleyWarn = tele('disc_crimson.glb')
}

function startVolley() {
  ensureVolley()
  lastVolleyFrame = state.time
  volleyWave = 0
  volleyHit = false
  say('ARCHIVE VOLLEY  ·  slip between the crimson bolts', 2)
}

function launchWave(w: number) {
  const v = ATTACKS.volley
  const p = playerPos()
  // The first wave is offset so the player is not standing exactly on a line.
  const base = (p ? headingDeg(sub(p, center)) : 0) + 360 / v.boltsPerWave / 2 + w * v.spinDeg * (w % 2 === 0 ? 1 : -1)
  for (let i = 0; i < v.boltsPerWave; i++) {
    const b = bolts[w * v.boltsPerWave + i]
    const a = ((base + (i * 360) / v.boltsPerWave) * Math.PI) / 180
    b.active = true
    b.dx = Math.sin(a)
    b.dz = Math.cos(a)
    b.x = center.x + b.dx * (ARENA.daisRadius - 1)
    b.z = center.z + b.dz * (ARENA.daisRadius - 1)
    b.px = b.x
    b.pz = b.z
    setShown(b.e, true)
  }
}

function updateVolley(): boolean {
  const v = ATTACKS.volley
  const t = state.time - startedAt
  const dt = Math.min(0.1, state.time - lastVolleyFrame)
  lastVolleyFrame = state.time
  // Warning: a pulsing crimson disc under the Watcher as the halos charge.
  if (volleyWarn) {
    if (t < v.warning) {
      const k = (ARENA.daisRadius + 1) * (0.85 + 0.15 * Math.sin(t * 12))
      const tr = Transform.getMutable(volleyWarn)
      tr.position = Vector3.create(center.x, 0.09, center.z)
      tr.scale = Vector3.create(k, 1, k)
    } else hide(volleyWarn)
  }
  while (volleyWave < v.waves && t >= v.warning + volleyWave * v.waveInterval) launchWave(volleyWave++)

  const p = playerPos()
  let anyActive = false
  for (const b of bolts) {
    if (!b.active) continue
    b.px = b.x
    b.pz = b.z
    b.x += b.dx * v.speed * dt
    b.z += b.dz * v.speed * dt
    if (Math.hypot(b.x - center.x, b.z - center.z) > ARENA.playableRadius + ARENA.borderMargin) {
      b.active = false
      Transform.getMutable(b.e).position = HIDDEN
      setShown(b.e, false)
      continue
    }
    anyActive = true
    Transform.getMutable(b.e).position = Vector3.create(b.x, v.boltHeight, b.z)
    if (!volleyHit && p && p.y < v.jumpClear) {
      const d = pointSegmentDistance(v3(p.x, v.boltHeight, p.z), v3(b.px, v.boltHeight, b.pz), v3(b.x, v.boltHeight, b.z))
      if (d <= v.hitRadius) {
        volleyHit = true // one hit per volley
        damagePlayer(v.damage, 'the Archive Volley')
      }
    }
  }
  if (volleyWave >= v.waves && !anyActive) {
    endVolley()
    return true
  }
  return false
}
let lastVolleyFrame = 0

function endVolley() {
  for (const b of bolts) {
    b.active = false
    Transform.getMutable(b.e).position = HIDDEN
    setShown(b.e, false)
  }
  if (volleyWarn) hide(volleyWarn)
}
