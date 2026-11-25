// Flying spell projectiles: a bright core with a soft halo and a stretched streak, leaving a
// particle trail. The hit is decided at launch (fixed direction, stationary target) and the
// damage is applied when the projectile actually arrives, so feedback matches what you see.
import { Entity, Material, MaterialTransparencyMode, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { IMPRINT } from '../config'
import { V3, add, dist, norm, scale, sub } from '../math/vec'
import { state } from '../game/state'
import { onReset } from '../game/session'
import { burst, claimTrail, moveTrail, releaseTrail } from './vfx'

const POOL = 14
const HIDDEN = Vector3.create(0, -40, 0)
const AXIS_FIX = Quaternion.fromEulerDegrees(90, 0, 0) // cylinder Y axis -> forward

type Projectile = {
  id: number
  root: Entity
  core: Entity
  halo: Entity
  streak: Entity
  active: boolean
  from: V3
  dir: V3
  length: number
  travelled: number
  speed: number
  hit: boolean
  run: number
  trail: number
  color: string
  size: number
  onArrive?: () => void
}
const pool: Projectile[] = []
let nextId = 1

const rgba = (hex: string, a: number) => {
  const c = Color4.fromHexString(hex)
  return Color4.create(c.r, c.g, c.b, a)
}
const rgb = (hex: string) => {
  const c = Color4.fromHexString(hex)
  return Color3.create(c.r, c.g, c.b)
}

function paint(p: Projectile, hex: string) {
  if (p.color === hex) return
  p.color = hex
  Material.setPbrMaterial(p.core, { albedoColor: rgba('#FFFFFF', 1), emissiveColor: rgb(hex), emissiveIntensity: 6 })
  Material.setPbrMaterial(p.halo, { albedoColor: rgba(hex, 0.28), emissiveColor: rgb(hex), emissiveIntensity: 3, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
  Material.setPbrMaterial(p.streak, { albedoColor: rgba(hex, 0.45), emissiveColor: rgb(hex), emissiveIntensity: 4, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
}

export function initProjectiles() {
  for (let i = 0; i < POOL; i++) {
    const root = engine.addEntity()
    Transform.create(root, { position: HIDDEN })
    const core = engine.addEntity()
    Transform.create(core, { parent: root, scale: Vector3.create(0.26, 0.26, 0.26) })
    MeshRenderer.setSphere(core)
    const halo = engine.addEntity()
    Transform.create(halo, { parent: root, scale: Vector3.create(0.7, 0.7, 0.7) })
    MeshRenderer.setSphere(halo)
    const streak = engine.addEntity()
    Transform.create(streak, { parent: root })
    MeshRenderer.setCylinder(streak, 0.12, 0.5) // wide at the core (front), tapering behind
    pool.push({ id: 0, root, core, halo, streak, active: false, from: HIDDEN, dir: Vector3.Forward(), length: 0, travelled: 0, speed: 0, hit: false, run: 0, trail: -1, color: '', size: 1 })
  }
  engine.addSystem(projectileSystem)
  onReset(() => pool.forEach(deactivate))
}

/**
 * Launch a spell from `from` to `to`. `onArrive` runs when it gets there (only in the same run).
 * `size` scales the visual (echo repeats are slightly smaller than direct casts).
 */
export function launch(from: V3, to: V3, colorHex: string, hit: boolean, onArrive?: () => void, size = 1, speed: number = IMPRINT.projectileSpeed) {
  let p = pool.find((x) => !x.active)
  if (!p) {
    // Pool exhausted: resolve the oldest immediately so no damage is ever lost.
    p = pool.reduce((a, b) => (a.id < b.id ? a : b))
    finish(p)
  }
  p.id = nextId++
  p.active = true
  p.from = { x: from.x, y: from.y, z: from.z }
  p.length = dist(from, to)
  p.dir = norm(sub(to, from))
  p.travelled = 0
  p.speed = speed
  p.hit = hit
  p.run = state.runId
  p.onArrive = onArrive
  p.size = size
  paint(p, colorHex)
  const k = size
  Transform.getMutable(p.core).scale = Vector3.create(0.26 * k, 0.26 * k, 0.26 * k)
  Transform.getMutable(p.halo).scale = Vector3.create(0.7 * k, 0.7 * k, 0.7 * k)
  Transform.getMutable(p.root).rotation = Quaternion.lookRotation(Vector3.create(p.dir.x, p.dir.y, p.dir.z))
  p.trail = claimTrail(p.id, colorHex, from)
  place(p)
}

function place(p: Projectile) {
  const pos = add(p.from, scale(p.dir, p.travelled))
  const tr = Transform.getMutable(p.root)
  tr.position = Vector3.create(pos.x, pos.y, pos.z)
  // Streak behind the core, growing to full length after launch.
  const len = Math.min(p.travelled, 2.4 * p.size)
  const st = Transform.getMutable(p.streak)
  st.position = Vector3.create(0, 0, -len / 2)
  st.rotation = AXIS_FIX
  st.scale = Vector3.create(0.22 * p.size, Math.max(0.01, len), 0.22 * p.size)
  moveTrail(p.id, p.trail, pos)
}

function finish(p: Projectile) {
  const end = add(p.from, scale(p.dir, p.length))
  if (p.run === state.runId) {
    burst(end, p.color, p.hit ? 1 : 0.45)
    p.onArrive?.()
  }
  deactivate(p)
}

function deactivate(p: Projectile) {
  if (p.active) releaseTrail(p.id)
  p.active = false
  p.onArrive = undefined
  Transform.getMutable(p.root).position = HIDDEN
}

function projectileSystem(dt: number) {
  const step = Math.min(dt, 0.1)
  for (const p of pool) {
    if (!p.active) continue
    if (p.run !== state.runId) {
      deactivate(p)
      continue
    }
    p.travelled += p.speed * step
    if (p.travelled >= p.length) finish(p)
    else place(p)
  }
}
