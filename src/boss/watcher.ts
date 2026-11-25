// The Watcher: modular model (body, helm, mask, 3 halo rings, 2 spectral hands) with procedural
// animation. Gameplay never reads the meshes: the hit volume comes from config (BOSS.*), so the
// model can change without affecting combat. If the GLBs are missing or fail to load, a
// primitive placeholder is shown instead (logged once).
import {
  ColliderLayer,
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
import { ARENA, BOSS, COLORS, WATCHER_MODEL as M } from '../config'
import { HitCylinder } from '../combat/aim'
import { isActive, state } from '../game/state'
import { onReset } from '../game/session'

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
let fallbackEye: Entity | undefined
const fallbackRings: { entity: Entity; speed: number }[] = []

type ModelStatus = 'loading' | 'ready' | 'fallback'
let status: ModelStatus = M.enabled ? 'loading' : 'fallback'
let visage: 'helm' | 'mask' = 'helm'
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

  createFallback()
  if (M.enabled) createModel()
  else showFallback(true)

  engine.addSystem(watcherSystem)
  onReset(() => setVisage('helm'))
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
  Transform.getMutable(fallback).scale = show ? Vector3.One() : HIDDEN_SCALE
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
    showFallback(false)
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
  // Preview key: 1 swaps helm <-> ivory mask (final-transformation look). Remove before release.
  if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) setVisage(visage === 'helm' ? 'mask' : 'helm')

  // Idle levitation and a slow, patient sway. On victory he sinks (full cinematic in M6).
  const tr = Transform.getMutable(root)
  const sink = state.phase === 'victory' ? Math.min(1.6, (t - state.endedAt) * 0.45) : 0
  tr.position.y = BOSS.hoverHeight + Math.sin(t * 1.1) * 0.14 - sink
  const frozen = state.phase === 'victory'

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

  if (status === 'ready' || status === 'loading') {
    // Hit reaction: brief recoil (overlapping-silhouette effect comes in M6).
    const mt = Transform.getMutable(model)
    const s = M.scale * (flashing ? 0.97 : 1)
    mt.scale = Vector3.create(flashing ? M.scale * 1.03 : s, s, flashing ? M.scale * 1.03 : s)

    // The Archive: independent rotation in the ring plane plus a slow breathing tilt.
    halos.forEach((h, i) => {
      const ht = Transform.getMutable(h.entity)
      const spin = ((frozen ? state.endedAt : t) * h.speed) % 360
      ht.rotation = Quaternion.fromEulerDegrees(h.tilt + Math.sin(t * 0.4 + i) * 3, Math.sin(t * 0.3 + i * 2) * 4, spin)
    })

    // Spectral hands: drift, slow wrist turns and a curling gesture, out of phase with each other.
    hands.forEach((h, i) => {
      const ht = Transform.getMutable(h.entity)
      const ph = t * 0.9 + i * 1.7
      ht.position = Vector3.create(h.base.x + Math.sin(ph * 0.6) * 0.12, h.base.y + Math.sin(ph) * 0.22, h.base.z + Math.cos(ph * 0.5) * 0.1)
      const gesture = Math.sin(t * 0.55 + i * 2.4)
      ht.rotation = Quaternion.fromEulerDegrees(-10 + gesture * 14, h.side * (20 + gesture * 10), h.side * (-12 + Math.sin(ph * 0.8) * 8))
    })
  }

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
