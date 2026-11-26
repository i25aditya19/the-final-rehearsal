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
const hands: { entity: Entity; base: Vector3; side: number }[] = []
/** Primitive stand-in shown until (or instead of) the GLB model. */
let fallback: Entity
let eyeOrb: Entity | undefined
let eyeLight: Entity | undefined
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

  // The single crimson eye: a small intense emissive core plus a tight crimson light, so it reads
  // from the far side of the arena (the eye texture alone is too small).
  eyeOrb = engine.addEntity()
  Transform.create(eyeOrb, { parent: model, position: eyeLocal(), scale: Vector3.create(0.05, 0.05, 0.05) })
  GltfContainer.create(eyeOrb, { src: 'assets/fx/orb_crimson.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  eyeLight = engine.addEntity()
  Transform.create(eyeLight, { parent: model, position: Vector3.add(eyeLocal(), Vector3.create(0, 0, 0.25)) })
  LightSource.create(eyeLight, { type: LightSource.Type.Point({}), color: Color3.create(0.9, 0.12, 0.25), intensity: 2200, range: 6 })

  // The Archive: one halo model, three instances at different sizes and speeds (world metres,
  // so they are parented to the root, not the scaled model).
  const head = Vector3.create(M.head.x * s, M.head.y * s, M.head.z * s + M.haloOffsetZ)
  M.haloDiameters.forEach((d, i) => {
    const k = d / 0.3
    const e = gltf(root, M.halo, head, Vector3.create(k, k, k))
    halos.push({ entity: e, speed: M.haloSpeeds[i] ?? 8, tilt: (i - 1) * 4 })
  })

  // Spectral hands: the right hand is the model as-is, the left is mirrored on X.
  M.handOffsets.forEach((o, i) => {
    const side = o.x < 0 ? -1 : 1
    const base = Vector3.create(o.x, o.y, o.z)
    const e = gltf(root, M.hand, base, Vector3.create(side < 0 ? -M.handScale : M.handScale, M.handScale, M.handScale))
    hands.push({ entity: e, base, side })
  })
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
  if (isActive() && Transform.has(engine.PlayerEntity)) {
    const p = Transform.get(engine.PlayerEntity).position
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

  // Hit reaction: recoil plus a sideways jolt (the "overlapping silhouettes" flicker).
  if (flashing) jolt = (Math.random() < 0.5 ? -1 : 1) * 0.18
  jolt *= Math.max(0, 1 - dt * 12)
  const mt = Transform.getMutable(model)
  const victoryShrink = frozen ? Math.max(0, 1 - Math.max(0, te - 3.0) / 2.5) : 1
  const s = M.scale * victoryShrink * (flashing ? 0.97 : 1)
  mt.scale = Vector3.create(flashing ? s * 1.06 : s, s, flashing ? s * 1.06 : s)
  mt.position = Vector3.create(jolt, 0, -a * 0.25)
  // Lean in toward the player while winding up.
  mt.rotation = Quaternion.fromEulerDegrees(a * 8, 0, jolt * 10)

  // The Archive. Phase II: rings fall out of sync. Phase III: they expand and race.
  // Winding up an attack spins them faster. Victory: they freeze, then burst apart.
  halos.forEach((h, i) => {
    const ht = Transform.getMutable(h.entity)
    if (haloBase[i] === undefined) haloBase[i] = ht.scale.x
    let speed = h.speed * (1 + 2.5 * a)
    if (phase === 2) speed *= 1 + 0.6 * Math.sin(t * (0.7 + i * 0.4) + i)
    if (phase === 3) speed *= 1.8
    if (!frozen) haloAngle[i] = (haloAngle[i] + speed * dt) % 360
    const wobble = phase >= 2 ? 6 + 4 * phase : 3
    ht.rotation = Quaternion.fromEulerDegrees(h.tilt + Math.sin(t * 0.4 + i) * wobble, Math.sin(t * 0.3 + i * 2) * (wobble + 1), haloAngle[i])
    let k = haloBase[i] * (phase === 3 ? 1.2 : 1)
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
    ht.position = Vector3.create(
      h.base.x * (1 - 0.25 * a) + Math.sin(ph * 0.6) * 0.12,
      h.base.y + 1.3 * a + Math.sin(ph) * 0.22,
      h.base.z + 0.9 * a + Math.cos(ph * 0.5) * 0.1
    )
    const gesture = Math.sin(t * 0.55 + i * 2.4)
    ht.rotation = Quaternion.fromEulerDegrees(-10 + gesture * 14 - 55 * a, h.side * (20 + gesture * 10), h.side * (-12 + Math.sin(ph * 0.8) * 8))
    const hs = M.handScale * victoryFade
    ht.scale = Vector3.create(h.side < 0 ? -hs : hs, hs, hs)
  })

  // The ivory mask: in phase III it widens (the mask 'opens'); the eye burns brighter when he
  // winds up an attack. Hidden once shattered.
  if (status === 'ready' && !shattered) {
    const kMask = M.maskScale * (phase === 3 ? 1.14 : 1) * (1 + 0.03 * a)
    if (visage === 'mask') Transform.getMutable(mask).scale = Vector3.create(kMask, kMask, kMask)
    if (eyeOrb) {
      const et = Transform.getMutable(eyeOrb)
      et.position = eyeLocal()
      const ke = (phase === 3 ? 0.075 : 0.05) * (1 + 0.6 * a) * (flashing ? 1.5 : 1)
      et.scale = Vector3.create(ke, ke, ke)
    }
    if (eyeLight) {
      const l = LightSource.getMutable(eyeLight)
      l.intensity = (phase === 3 ? 4200 : 2200) * (1 + 1.5 * a)
    }
  } else if (shattered && eyeOrb) {
    Transform.getMutable(eyeOrb).scale = Vector3.Zero()
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
