// The Watcher: modular model (body, helm, mask, 3 halo rings, 2 spectral hands) with procedural
// animation. Gameplay never reads the meshes: the hit volume comes from config (BOSS.*), so the
// model can change without affecting combat. If the GLBs are missing or fail to load, a
// primitive placeholder is shown instead (logged once).
import {
  ColliderLayer,
  LightSource,
  InputAction,
  PointerEventType,
  inputSystem,
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  GltfContainerLoadingState,
  LoadingState,
  Material,
  MeshCollider,
  MeshRenderer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, BOSS, COLORS, UI, WATCHER_MODEL as M } from '../config'
import { HitCylinder } from '../combat/aim'
import { isActive, state } from '../game/state'
import { onReset } from '../game/session'
import { attachBossAura, burst } from '../effects/vfx'
import { V3 } from '../math/vec'
import { attackDebug } from './attacks'
import { corruptionDebug } from './corruption'
import { setShown } from '../effects/visibility'

const col4 = (hex: string) => Color4.fromHexString(hex)
const col3 = (hex: string) => {
  const c = Color4.fromHexString(hex)
  return Color3.create(c.r, c.g, c.b)
}

/** Root follows levitation and facing; everything else hangs off it. */
let root: Entity
/** Holds the model parts (scaled to WATCHER_MODEL.scale). */
let model: Entity
let body: Entity
let helm: Entity
let mask: Entity
const halos: { entity: Entity; speed: number; tilt: number }[] = []
const hands: { entity: Entity; base: Vector3; side: number; minPhase: number; size: number; grow?: number }[] = []
/** Primitive stand-in shown until (or instead of) the GLB model. */
let fallback: Entity
let eyeOrb: Entity | undefined
let eyeLight: Entity | undefined // cool rim light behind the head (no longer crimson: it tinted the mask)
let eyeGlow: Entity | undefined
// Damage afterimage: a translucent pale copy of the robe that flickers out behind him on a hit.
let ghost: Entity | undefined
let ghostUntil = 0
let ghostSide = 1
// The Watcher's own temporal echo: a crimson afterimage that performs the repeated Aftershock
// (he uses the same forbidden magic as the player) and flickers when he 'blinks' between phases.
let crimsonGhost: Entity | undefined
// He notices: a new echo draws his gaze for a moment before he returns to the player.
let seenEchoIds: number[] = []
let glanceUntil = -1
let glanceAt: V3 | undefined
/** Eye position in body-model units for the current face (mask eye, or the helm's slit). */
function eyeLocal(): Vector3 {
  return visage === 'mask' ? Vector3.create(0, 1.757, 0.28) : Vector3.create(0, 1.624, 0.262)
}
let fallbackEye: Entity | undefined
const fallbackRings: { entity: Entity; speed: number }[] = []

type ModelStatus = 'loading' | 'ready' | 'fallback'
let status: ModelStatus = M.enabled ? 'loading' : 'fallback'
let visage: 'helm' | 'mask' = M.startVisage
const HIDDEN_SCALE = Vector3.create(0, 0, 0)

/** Boss hit volume in scene coordinates (forgiving cylinder around the floating figure). */
export function bossHitVolume(): HitCylinder {
  const base = BOSS.hoverHeight - BOSS.hitHeight / 2
  return {
    center: { x: ARENA.center.x, y: 0, z: ARENA.center.z },
    radius: BOSS.hitRadius,
    yMin: Math.max(0, base),
    yMax: base + BOSS.hitHeight
  }
}

function gltf(parent: Entity, src: string, position: Vector3, scale: Vector3, rotation = Quaternion.Identity()): Entity {
  const e = engine.addEntity()
  Transform.create(e, { parent, position, scale, rotation })
  // The AI models carry no collider meshes; combat uses the config hit volume, movement the blocker.
  GltfContainer.create(e, { src, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  return e
}

export function createWatcher() {
  // Solid core so the player cannot walk inside the boss (physics only, not clickable).
  const blocker = engine.addEntity()
  Transform.create(blocker, { position: Vector3.create(ARENA.center.x, 1.5, ARENA.center.z), scale: Vector3.create(2, 3, 2) })
  MeshCollider.setCylinder(blocker, 0.5, 0.5, ColliderLayer.CL_PHYSICS)

  root = engine.addEntity()
  Transform.create(root, { position: Vector3.create(ARENA.center.x, BOSS.hoverHeight, ARENA.center.z) })

  attachBossAura(root)
  createFallback()
  if (M.enabled) createModel()
  else showFallback(true)

  engine.addSystem(watcherSystem)
  onReset(() => {
    resetLiving()
    setVisage(M.startVisage)
  })
}

function createModel() {
  const s = M.scale
  model = engine.addEntity()
  Transform.create(model, { parent: root, scale: Vector3.create(s, s, s) })

  body = gltf(model, M.body, Vector3.Zero(), Vector3.One())
  // The helm was cut from the same mesh, so it shares the body's frame exactly.
  helm = gltf(model, M.helm, Vector3.Zero(), Vector3.One())
  // The ivory mask replaces the helm for the final transformation; hidden until then.
  mask = gltf(model, M.mask, Vector3.create(M.maskOffset.x, M.maskOffset.y, M.maskOffset.z), HIDDEN_SCALE)

  // The single crimson eye: an intense emissive core inside a soft crimson glow, so it reads from
  // the far side of the arena. No crimson light: it washed the ivory mask pink in the client.
  eyeOrb = engine.addEntity()
  Transform.create(eyeOrb, { parent: model, position: eyeLocal(), scale: Vector3.create(0.065, 0.065, 0.065) })
  GltfContainer.create(eyeOrb, { src: 'assets/fx/orb_crimson.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  eyeGlow = engine.addEntity()
  Transform.create(eyeGlow, { parent: model, position: eyeLocal(), scale: Vector3.create(0.16, 0.16, 0.16) })
  GltfContainer.create(eyeGlow, { src: 'assets/fx/glow_crimson.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  ghost = engine.addEntity()
  Transform.create(ghost, { parent: root, scale: Vector3.create(M.scale, M.scale, M.scale) })
  GltfContainer.create(ghost, { src: M.body, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  GltfNodeModifiers.create(ghost, {
    modifiers: [{ path: '', castShadows: false, material: { material: { $case: 'pbr', pbr: {
      albedoColor: Color4.create(0.85, 0.9, 1, 0.22), emissiveColor: Color3.create(0.75, 0.82, 0.95), emissiveIntensity: 1.2,
      transparencyMode: 2 /* MTM_ALPHA_BLEND */, metallic: 0, roughness: 1 } } } }]
  })
  setShown(ghost, false)
  crimsonGhost = engine.addEntity()
  Transform.create(crimsonGhost, { parent: root, scale: Vector3.create(M.scale, M.scale, M.scale) })
  GltfContainer.create(crimsonGhost, { src: M.body, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  GltfNodeModifiers.create(crimsonGhost, {
    modifiers: [{ path: '', castShadows: false, material: { material: { $case: 'pbr', pbr: {
      albedoColor: Color4.create(0.85, 0.12, 0.22, 0.3), emissiveColor: Color3.create(0.9, 0.1, 0.25), emissiveIntensity: 2,
      transparencyMode: 2, metallic: 0, roughness: 1 } } } }]
  })
  setShown(crimsonGhost, false)
  // Cool rim light behind the head: backlights the halos and shoulders so the black robes separate
  // from the dark chamber.
  eyeLight = engine.addEntity()
  Transform.create(eyeLight, { parent: model, position: Vector3.create(0, 1.75, -1.0) })
  LightSource.create(eyeLight, { type: LightSource.Type.Point({}), color: Color3.create(0.82, 0.86, 0.95), intensity: 2600, range: 5 })

  // The Archive: one halo model, three instances at different sizes and speeds (world metres,
  // so they are parented to the root, not the scaled model).
  const head = Vector3.create(M.head.x * s, M.head.y * s, M.head.z * s + M.haloOffsetZ)
  M.haloDiameters.forEach((d, i) => {
    const k = d / 0.3
    const e = gltf(root, M.halo, head, Vector3.create(k, k, k))
    // Halos cast no shadows: their spiked rings made a busy pattern on the floor.
    GltfNodeModifiers.createOrReplace(e, { modifiers: [{ path: '', castShadows: false }] })
    halos.push({ entity: e, speed: M.haloSpeeds[i] ?? 8, tilt: (i - 1) * 4 })
  })

  // Spectral hands: the right hand is the model as-is, the left is mirrored on X.
  M.handOffsets.forEach((o, i) => {
    const side = o.x < 0 ? -1 : 1
    const base = Vector3.create(o.x, o.y, o.z)
    const e = gltf(root, M.hand, base, Vector3.create(side < 0 ? -M.handScale : M.handScale, M.handScale, M.handScale))
    hands.push({ entity: e, base, side, minPhase: 1, size: 1 })
  })
  // Phase II "The Interference": a second, smaller pair of hands emerges higher and further back.
  for (const o of [{ x: -1.9, y: 2.6, z: -0.6 }, { x: 1.9, y: 2.6, z: -0.6 }]) {
    const side = o.x < 0 ? -1 : 1
    const base = Vector3.create(o.x, o.y, o.z)
    const e = gltf(root, M.hand, base, HIDDEN_SCALE)
    hands.push({ entity: e, base, side, minPhase: 2, size: 0.7 })
  }
}

/** Simple primitive Watcher (the M1 placeholder) used when the model is missing. */
function createFallback() {
  fallback = engine.addEntity()
  Transform.create(fallback, { parent: root, position: Vector3.create(0, -1.5, 0) })
  const part = (pos: Vector3, scale: Vector3, color: string, mesh: 'box' | 'sphere' | 'cylinder', emissive = 0, rt = 0.5, rb = 0.5, parent = fallback) => {
    const e = engine.addEntity()
    Transform.create(e, { parent, position: pos, scale })
    if (mesh === 'box') MeshRenderer.setBox(e)
    else if (mesh === 'sphere') MeshRenderer.setSphere(e)
    else MeshRenderer.setCylinder(e, rb, rt)
    Material.setPbrMaterial(e, { albedoColor: col4(color), roughness: 0.6, ...(emissive ? { emissiveColor: col3(color), emissiveIntensity: emissive } : {}) })
    return e
  }
  part(Vector3.create(0, 1.5, 0), Vector3.create(2.2, 3.4, 2.2), COLORS.obsidian, 'cylinder', 0, 0.16, 0.5)
  part(Vector3.create(0, 3.35, -0.05), Vector3.create(1.05, 1.2, 1.0), COLORS.charcoal, 'cylinder', 0, 0.3, 0.5)
  part(Vector3.create(0, 3.45, 0.42), Vector3.create(0.42, 0.95, 0.12), COLORS.ivory, 'box')
  fallbackEye = part(Vector3.create(0, 3.55, 0.5), Vector3.create(0.07, 0.11, 0.04), COLORS.dangerCrimson, 'sphere', 3)
  ;[0.85, 1.2, 1.55].forEach((radius, i) => {
    const ring = engine.addEntity()
    Transform.create(ring, { parent: fallback, position: Vector3.create(0, 3.5, -0.55) })
    const beads = 10 + i * 4
    for (let b = 0; b < beads; b++) {
      const a = (b / beads) * Math.PI * 2
      part(Vector3.create(Math.cos(a) * radius, Math.sin(a) * radius, 0), Vector3.create(0.11, 0.11, 0.11), COLORS.silver, 'box', 0.4, 0.5, 0.5, ring)
    }
    fallbackRings.push({ entity: ring, speed: [18, -11, 7][i] })
  })
  showFallback(!M.enabled)
}

function showFallback(show: boolean) {
  const t = Transform.getMutableOrNull(fallback)
  if (t) t.scale = show ? Vector3.One() : HIDDEN_SCALE
}

/** World position of the Watcher's eye (helm slit / mask eye), for beams that leave from it. */
export function watcherEyePosition(): V3 {
  const tr = Transform.get(root)
  const s = M.scale
  const e = eyeLocal()
  const local = Vector3.create(e.x * s, e.y * s, e.z * s)
  const w = Vector3.rotate(local, tr.rotation)
  return { x: tr.position.x + w.x, y: tr.position.y + w.y, z: tr.position.z + w.z }
}

/** Swap the helm for the ivory mask (final transformation) or back. */
export function setVisage(v: 'helm' | 'mask') {
  visage = v
  if (status !== 'ready') return
  Transform.getMutable(helm).scale = v === 'helm' ? Vector3.One() : HIDDEN_SCALE
  const k = M.maskScale
  Transform.getMutable(mask).scale = v === 'mask' ? Vector3.create(k, k, k) : HIDDEN_SCALE
}

export function getVisage() {
  return visage
}

const LOAD_TIMEOUT = 20
function checkModelLoaded() {
  if (status !== 'loading') return
  const parts = [body, helm, mask, ...halos.map((h) => h.entity), ...hands.map((h) => h.entity)]
  let finished = 0
  for (const e of parts) {
    const s = GltfContainerLoadingState.getOrNull(e)?.currentState
    if (s === LoadingState.FINISHED) finished++
    else if (s === LoadingState.NOT_FOUND || s === LoadingState.FINISHED_WITH_ERROR) {
      console.log(`[FinalRehearsal] Watcher model part failed to load (${GltfContainer.get(e).src}); using placeholder`)
      return useFallback()
    }
  }
  if (finished === parts.length) {
    status = 'ready'
    // The primitive stand-in is no longer needed: remove it entirely (it still cost draw calls).
    engine.removeEntityWithChildren(fallback)
    fallbackRings.length = 0
    fallbackEye = undefined
    setVisage(visage)
    console.log('[FinalRehearsal] Watcher model loaded')
  } else if (state.time > LOAD_TIMEOUT) {
    console.log('[FinalRehearsal] Watcher model still loading after timeout; showing placeholder meanwhile')
    showFallback(true)
  }
}

function useFallback() {
  status = 'fallback'
  Transform.getMutable(model).scale = HIDDEN_SCALE
  for (const h of halos) Transform.getMutable(h.entity).scale = HIDDEN_SCALE
  for (const h of hands) Transform.getMutable(h.entity).scale = HIDDEN_SCALE
  showFallback(true)
}

function watcherSystem(dt: number) {
  const t = state.time
  if (status === 'loading') checkModelLoaded()
  // Debug only: 1 swaps the ivory mask and the dark helm.
  if (UI.showDebug && inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) setVisage(visage === 'helm' ? 'mask' : 'helm')

  // Idle levitation and a slow, patient sway. On victory he sinks (full cinematic in M6).
  const tr = Transform.getMutable(root)
  // Victory: a held, frozen moment, then he sinks as the mask and halos break apart.
  const te = t - state.endedAt
  const victory = state.phase === 'victory'
  const sink = victory ? Math.max(0, Math.min(2.4, (te - 2.2) * 0.7)) : 0
  const bob = victory && te < 2.2 ? Math.sin(state.endedAt * 1.1) * 0.14 : Math.sin(t * 1.1) * 0.14
  // Phase III: abrupt, unsettled movement.
  const jitter = state.bossPhase === 3 && isActive() ? Math.sin(t * 13) * Math.max(0, Math.sin(t * 0.9)) * 0.08 : 0
  tr.position.y = BOSS.hoverHeight + bob - sink + jitter
  const frozen = victory

  // Glide-turn to face the player.
  const ids = state.echoes.map((e) => e.id)
  const fresh = state.echoes.find((e) => !seenEchoIds.includes(e.id) && !e.corrupted)
  if (fresh && state.echoes.length > 0 && t > 1) {
    glanceUntil = t + 1.1
    glanceAt = fresh.pos
  }
  seenEchoIds = ids
  if (isActive() && Transform.has(engine.PlayerEntity)) {
    const p = t < glanceUntil && glanceAt ? glanceAt : Transform.get(engine.PlayerEntity).position
    const dx = p.x - ARENA.center.x
    const dz = p.z - ARENA.center.z
    if (dx * dx + dz * dz > 0.01) {
      const yaw = (Math.atan2(dx, dz) * 180) / Math.PI
      const target = Quaternion.fromEulerDegrees(Math.sin(t * 0.7) * 1.5, yaw, Math.sin(t * 0.5) * 1.2)
      tr.rotation = Quaternion.slerp(tr.rotation, target, Math.min(1, dt * 1.4))
    }
  }

  const flashing = t < state.bossFlashUntil

  if (status === 'ready' || status === 'loading') animateModel(t, dt, flashing, frozen)

  if (status !== 'ready') {
    for (const r of fallbackRings) {
      const rt = Transform.getMutable(r.entity)
      rt.rotation = Quaternion.multiply(rt.rotation, Quaternion.fromEulerDegrees(0, 0, r.speed * dt))
    }
    if (fallbackEye) {
      const m = Material.getMutableOrNull(fallbackEye)
      if (m && m.material?.$case === 'pbr') m.material.pbr.emissiveIntensity = flashing ? 8 : 3
    }
  }
}

// ---------------------------------------------------------------- living animation
const haloAngle = [0, 0, 0]
const haloBase: number[] = []
const shards: { e: Entity; vx: number; vy: number; vz: number; spin: number }[] = []
let shattered = false
let jolt = 0

/** Smooth 0..1 anticipation while the Watcher winds up an attack (its warning window). */
function anticipation(t: number): number {
  if (!state.bossCasting || !isActive()) return 0
  const since = t - state.bossCastAt
  const rise = Math.min(1, since / 0.5)
  const fall = since > 1.6 ? Math.max(0, 1 - (since - 1.6) / 0.6) : 1
  return rise * fall
}

function animateModel(t: number, dt: number, flashing: boolean, frozen: boolean) {
  const a = anticipation(t)
  const phase = state.bossPhase
  const te = t - state.endedAt
  // Each attack has its own wind-up, so players learn to read him, not only the floor:
  // Gaze: eye flares, he leans in. Aftershock: both hands rise high. Stolen Moment: one hand
  // reaches toward the targeted echo. Blind Spot: halos swell and tip flat. Final Observation:
  // posture opens wide, mask widens. Archive Volley: hands circle.
  const kind = state.bossCasting ? attackDebug().kind : undefined
  const aG = kind === 'gaze' ? a : 0
  const aA = kind === 'aftershock' ? a : 0
  const aS = kind === 'stolen' ? a : 0
  const aB = kind === 'blindspot' ? a : 0
  const aO = kind === 'observation' ? a : 0
  const aV = kind === 'volley' ? a : 0
  if (crimsonGhost) {
    const dbg = attackDebug()
    const rep = dbg.kind === 'aftershock' && dbg.waves.length > 1 ? dbg.waves[1] : undefined
    const repeating = rep && t >= rep.warnAt && t < rep.startAt + 0.9
    const transStart = state.stage === 'transition' ? t - state.stageStartedAt : -1
    const blinking = transStart >= 0 && transStart < 0.9
    const on = !frozen && (!!repeating || blinking)
    setShown(crimsonGhost, on)
    if (on) {
      const g = Transform.getMutable(crimsonGhost)
      if (repeating && rep) {
        // rises and spreads while the repeated wave is foreshadowed, then fades out as it fires
        const p = Math.min(1, (t - rep.warnAt) / Math.max(0.1, rep.startAt - rep.warnAt))
        const k = M.scale * (1.03 + 0.05 * p)
        g.scale = Vector3.create(k, k, k)
        g.position = Vector3.create(0, 0.25 + 0.5 * p, -0.6)
      } else {
        const k = M.scale * (1.1 + 0.3 * transStart)
        g.scale = Vector3.create(k, k * 0.98, k)
        g.position = Vector3.create(Math.sin(t * 40) * 0.4, 0.1, -0.4 - transStart)
      }
    }
  }
  // Idle: an occasional slow pulse of the eye.
  const pulse = Math.max(0, Math.sin(t * 0.9)) ** 12
  if (ghost) {
    if (flashing && t > ghostUntil - 0.25) {
      ghostUntil = t + 0.32
      ghostSide = -ghostSide
    }
    const on = t < ghostUntil && !frozen
    setShown(ghost, on)
    if (on) {
      const p = 1 - (ghostUntil - t) / 0.32
      const gs = M.scale * (1.02 + 0.08 * p)
      const g = Transform.getMutable(ghost)
      g.scale = Vector3.create(gs, gs, gs)
      g.position = Vector3.create(ghostSide * (0.25 + 0.35 * p), 0.05, -0.2 - 0.3 * p)
    }
  }

  // Hit reaction: recoil plus a sideways jolt (the "overlapping silhouettes" flicker).
  if (flashing) jolt = (Math.random() < 0.5 ? -1 : 1) * 0.18
  jolt *= Math.max(0, 1 - dt * 12)
  const mt = Transform.getMutable(model)
  const victoryShrink = frozen ? Math.max(0, 1 - Math.max(0, te - 3.0) / 2.5) : 1
  const s = M.scale * victoryShrink * (flashing ? 0.97 : 1)
  mt.scale = Vector3.create(flashing ? s * 1.06 : s, s, flashing ? s * 1.06 : s)
  mt.position = Vector3.create(jolt, 0, -a * 0.25 + aO * 0.3)
  // Lean in toward the player while winding up (Gaze: further); open up and back for the Observation.
  mt.rotation = Quaternion.fromEulerDegrees(a * 8 + aG * 7 - aO * 14, 0, jolt * 10)

  // The Archive. Phase II: rings fall out of sync. Phase III: they expand and race.
  // Winding up an attack spins them faster. Victory: they freeze, then burst apart.
  halos.forEach((h, i) => {
    const ht = Transform.getMutable(h.entity)
    if (haloBase[i] === undefined) haloBase[i] = ht.scale.x
    let speed = h.speed * (1 + 2.5 * a) * (flashing ? 1.8 : 1)
    if (phase === 2) speed *= 1 + 0.6 * Math.sin(t * (0.7 + i * 0.4) + i)
    if (phase === 3) speed *= 1.8
    if (!frozen) haloAngle[i] = (haloAngle[i] + speed * dt) % 360
    const wobble = phase >= 2 ? 6 + 4 * phase : 3
    const unstable = flashing ? Math.sin(t * 60 + i) * 6 : 0
    ht.rotation = Quaternion.fromEulerDegrees(h.tilt + Math.sin(t * 0.4 + i) * wobble + aB * (25 + i * 10) + unstable, Math.sin(t * 0.3 + i * 2) * (wobble + 1), haloAngle[i])
    const intro = Math.min(1, state.time / 2.5)
    let k = haloBase[i] * (phase === 3 ? 1.2 : 1) * (0.5 + 0.5 * intro) * (1 + 0.35 * aB + 0.15 * aO)
    if (frozen && te > 1.6) {
      // break: swell outward then vanish, one ring after another
      const p = Math.min(1, Math.max(0, (te - 1.6 - i * 0.18) / 0.9))
      k = p >= 1 ? 0 : haloBase[i] * (1.2 + 1.4 * p)
    }
    ht.scale = Vector3.create(k, k, k)
  })

  // Spectral hands: drift and curl; rise and reach forward when he winds up an attack.
  hands.forEach((h, i) => {
    const ht = Transform.getMutable(h.entity)
    const ph = t * (phase >= 2 ? 1.3 : 0.9) + i * 1.7
    const victoryFade = frozen ? Math.max(0, 1 - Math.max(0, te - 2.0) / 1.2) : 1
    // Stolen Moment: the hand on the target echo's side stretches out toward it.
    const reach = aS > 0 && h.side === stolenSide() ? aS : 0
    const generic = a - aA - aS - aO
    const circle = aV * 0.9
    ht.position = Vector3.create(
      h.base.x * (1 - 0.25 * generic + 0.15 * aA + 0.5 * aO + 0.35 * reach) + Math.sin(ph * 0.6) * 0.12 + Math.sin(t * 5 + i * Math.PI) * circle,
      h.base.y + 1.3 * generic + 2.4 * aA + 1.1 * aO - 0.6 * reach + Math.sin(ph) * 0.22 + Math.cos(t * 5 + i * Math.PI) * circle,
      h.base.z + 0.9 * generic + 0.3 * aA + 2.2 * reach + Math.cos(ph * 0.5) * 0.1
    )
    const gesture = Math.sin(t * 0.55 + i * 2.4)
    ht.rotation = Quaternion.fromEulerDegrees(-10 + gesture * 14 - 55 * generic - 80 * aA - 60 * reach + 30 * aO, h.side * (20 + gesture * 10 + 30 * aO), h.side * (-12 + Math.sin(ph * 0.8) * 8))
    // extra hands grow in over ~1.5 s once their phase arrives
    if (h.grow === undefined) h.grow = 0
    h.grow += ((phase >= h.minPhase ? 1 : 0) - h.grow) * Math.min(1, dt * 2)
    const hs = M.handScale * victoryFade * h.size * (h.minPhase > 1 ? h.grow : 1)
    ht.scale = Vector3.create(h.side < 0 ? -hs : hs, hs, hs)
  })

  // The ivory mask: in phase III it widens (the mask 'opens'); the eye burns brighter when he
  // winds up an attack. Hidden once shattered.
  if (status === 'ready' && !shattered) {
    const kMask = M.maskScale * (phase === 3 ? 1.14 : 1) * (1 + 0.03 * a + 0.06 * aO)
    if (visage === 'mask') Transform.getMutable(mask).scale = Vector3.create(kMask, kMask, kMask)
    if (eyeOrb) {
      const et = Transform.getMutable(eyeOrb)
      et.position = eyeLocal()
      const ke = (phase === 3 ? 0.09 : 0.065) * (1 + 0.6 * a + 0.9 * aG + 0.35 * pulse) * (flashing ? 1.5 : 1) * Math.min(1, state.time / 2)
      et.scale = Vector3.create(ke, ke, ke)
      if (eyeGlow) {
        const g = Transform.getMutable(eyeGlow)
        g.position = et.position
        const kg = ke * (2.4 + 0.5 * Math.sin(t * 3))
        g.scale = Vector3.create(kg, kg, kg)
      }
    }
    if (eyeLight) {
      const l = LightSource.getMutable(eyeLight)
      l.intensity = (phase === 3 ? 3400 : 2600) * Math.min(1, state.time / 2)
    }
  } else if (shattered && eyeOrb) {
    Transform.getMutable(eyeOrb).scale = Vector3.Zero()
    if (eyeGlow) Transform.getMutable(eyeGlow).scale = Vector3.Zero()
    if (eyeLight) LightSource.getMutable(eyeLight).intensity = 0
  }

  // Victory: the helm or mask shatters into fragments that fall away.
  if (frozen && te > 1.6 && !shattered) shatter()
  if (shards.length && shattered) {
    for (const sh of shards) {
      const st = Transform.getMutable(sh.e)
      sh.vy -= 9.8 * 0.35 * dt
      st.position = Vector3.create(st.position.x + sh.vx * dt, Math.max(0.05, st.position.y + sh.vy * dt), st.position.z + sh.vz * dt)
      st.rotation = Quaternion.multiply(st.rotation, Quaternion.fromEulerDegrees(sh.spin * dt, sh.spin * 0.7 * dt, 0))
      const fadeK = Math.max(0, 1 - Math.max(0, te - 4.5) / 1.5)
      st.scale = Vector3.create(fadeK, fadeK, fadeK)
    }
  }
}

function shatter() {
  shattered = true
  Transform.getMutable(helm).scale = HIDDEN_SCALE
  Transform.getMutable(mask).scale = HIDDEN_SCALE
  const head = Vector3.add(Transform.get(root).position, Vector3.create(0, M.head.y * M.scale, 0.3))
  if (!shards.length) {
    for (let i = 0; i < 14; i++) {
      const e = engine.addEntity()
      Transform.create(e, { position: head })
      GltfContainer.create(e, { src: 'assets/fx/shard.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
      shards.push({ e, vx: 0, vy: 0, vz: 0, spin: 0 })
    }
  }
  shards.forEach((sh, i) => {
    const a = (i / shards.length) * Math.PI * 2
    sh.vx = Math.cos(a) * (2 + Math.random() * 2.5)
    sh.vz = Math.sin(a) * (2 + Math.random() * 2.5) + 1
    sh.vy = 2 + Math.random() * 3
    sh.spin = 200 + Math.random() * 300
    const st = Transform.getMutable(sh.e)
    st.position = head
    st.scale = Vector3.One()
  })
  burst({ x: head.x, y: head.y, z: head.z }, COLORS.finalWhite, 2.2)
}

function resetLiving() {
  shattered = false
  jolt = 0
  for (const sh of shards) {
    const st = Transform.getMutable(sh.e)
    st.position = Vector3.create(0, -40, 0)
    st.scale = Vector3.Zero()
  }
  halos.forEach((h, i) => {
    if (haloBase[i] !== undefined) Transform.getMutable(h.entity).scale = Vector3.create(haloBase[i], haloBase[i], haloBase[i])
  })
}

/** Which side (-1 left, +1 right, in the Watcher's frame) the Stolen Moment's target echo is on. */
function stolenSide(): number {
  const id = corruptionDebug().targetId
  const e = state.echoes.find((x) => x.id === id)
  if (!e || !Transform.has(root)) return 1
  const r = Transform.get(root)
  const right = Vector3.rotate(Vector3.Right(), r.rotation)
  return (e.pos.x - r.position.x) * right.x + (e.pos.z - r.position.z) * right.z >= 0 ? 1 : -1
}
