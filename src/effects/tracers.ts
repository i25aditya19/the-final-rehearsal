// Pooled spell traces: thin glowing beams from caster to hit/end point that fade out quickly.
// Also used for golden Convergence links between echoes.
import { Entity, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { IMPRINT } from '../config'
import { V3 } from '../math/vec'
import { state } from '../game/state'
import { onReset } from '../game/session'

const POOL_SIZE = 28
type Tracer = { entity: Entity; until: number; duration: number; width: number; from: V3; to: V3; color: string; intensity: number }
const pool: Tracer[] = []
const HIDDEN = Vector3.create(0, -10, 0)

export function createTracerPool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: HIDDEN, scale: Vector3.Zero() })
    MeshRenderer.setBox(e)
    pool.push({ entity: e, until: -1, duration: 1, width: 0, from: HIDDEN, to: HIDDEN, color: '', intensity: 0 })
  }
  engine.addSystem(tracerSystem)
  onReset(clearTracers)
}

export type TracerOpts = { width?: number; seconds?: number; intensity?: number }

export function spawnTracer(from: V3, to: V3, colorHex: string, impact: boolean, opts: TracerOpts = {}) {
  // Reuse a free tracer, or the one that expires soonest.
  let t = pool.find((p) => p.until < state.time)
  if (!t) t = pool.reduce((a, b) => (a.until < b.until ? a : b))
  t.from = from
  t.to = to
  t.duration = opts.seconds ?? IMPRINT.tracerSeconds
  t.until = state.time + t.duration
  t.width = opts.width ?? IMPRINT.tracerWidth
  const intensity = opts.intensity ?? (impact ? 6 : 3.5)
  // Only rebuild the material when the look actually changes.
  if (t.color !== colorHex || t.intensity !== intensity) {
    const c = Color4.fromHexString(colorHex)
    Material.setPbrMaterial(t.entity, {
      albedoColor: Color4.create(c.r, c.g, c.b, 1),
      emissiveColor: Color3.create(c.r, c.g, c.b),
      emissiveIntensity: intensity
    })
    t.color = colorHex
    t.intensity = intensity
  }
  place(t, 1)
}

function place(t: Tracer, k: number) {
  const dir = Vector3.subtract(t.to, t.from)
  const length = Vector3.length(dir)
  if (length < 0.01) return
  const tr = Transform.getMutable(t.entity)
  tr.position = Vector3.lerp(t.from, t.to, 0.5)
  tr.rotation = Quaternion.lookRotation(Vector3.normalize(dir))
  const w = t.width * k
  tr.scale = Vector3.create(w, w, length)
}

function tracerSystem() {
  for (const t of pool) {
    if (t.until < 0) continue
    const remaining = t.until - state.time
    if (remaining <= 0) {
      const tr = Transform.getMutable(t.entity)
      tr.scale = Vector3.Zero()
      tr.position = HIDDEN
      t.until = -1
    } else {
      place(t, Math.max(0.15, remaining / t.duration))
    }
  }
}

export function clearTracers() {
  for (const t of pool) {
    t.until = -1
    const tr = Transform.getMutable(t.entity)
    tr.scale = Vector3.Zero()
    tr.position = HIDDEN
  }
}
