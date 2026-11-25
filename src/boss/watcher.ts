// Placeholder Watcher built from primitives. Gameplay never reads these meshes: the hit volume
// comes from config (BOSS.*), so swapping in the real GLB model in M5 does not change combat.
import { ColliderLayer, Entity, Material, MeshCollider, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, BOSS, COLORS } from '../config'
import { HitCylinder } from '../combat/aim'
import { state } from '../game/state'

const col4 = (hex: string, a = 1) => {
  const c = Color4.fromHexString(hex)
  return Color4.create(c.r, c.g, c.b, a)
}
const col3 = (hex: string) => {
  const c = Color4.fromHexString(hex)
  return Color3.create(c.r, c.g, c.b)
}

let root: Entity
let body: Entity
let eye: Entity
const rings: { entity: Entity; speed: number }[] = []

/** Boss hit volume in scene coordinates (forgiving cylinder around the floating figure). */
export function bossHitVolume(): HitCylinder {
  const base = BOSS.hoverHeight - BOSS.hitHeight / 2
  return {
    center: { x: ARENA.center.x, y: 0, z: ARENA.center.z },
    radius: BOSS.hitRadius,
    yMin: Math.max(0, base),
    yMax: base + BOSS.hitHeight + 1
  }
}

function part(parent: Entity, pos: Vector3, scale: Vector3, color: string, mesh: 'box' | 'sphere' | 'cylinder', opts?: { emissive?: number; radiusTop?: number; radiusBottom?: number }): Entity {
  const e = engine.addEntity()
  Transform.create(e, { parent, position: pos, scale })
  if (mesh === 'box') MeshRenderer.setBox(e)
  else if (mesh === 'sphere') MeshRenderer.setSphere(e)
  else MeshRenderer.setCylinder(e, opts?.radiusBottom ?? 0.5, opts?.radiusTop ?? 0.5)
  Material.setPbrMaterial(e, {
    albedoColor: col4(color),
    roughness: 0.6,
    metallic: 0.1,
    ...(opts?.emissive ? { emissiveColor: col3(color), emissiveIntensity: opts.emissive } : {})
  })
  return e
}

export function createWatcher() {
  // Solid core so the player cannot walk inside the boss (physics only, not clickable).
  const blocker = engine.addEntity()
  Transform.create(blocker, { position: Vector3.create(ARENA.center.x, 1.5, ARENA.center.z), scale: Vector3.create(2, 3, 2) })
  MeshCollider.setCylinder(blocker, 0.5, 0.5, ColliderLayer.CL_PHYSICS)

  root = engine.addEntity()
  Transform.create(root, { position: Vector3.create(ARENA.center.x, BOSS.hoverHeight - 1.5, ARENA.center.z) })

  body = engine.addEntity()
  Transform.create(body, { parent: root })

  // Robes: tall tapering column that fades into the floor shadow.
  part(body, Vector3.create(0, 1.5, 0), Vector3.create(2.2, 3.4, 2.2), COLORS.obsidian, 'cylinder', { radiusTop: 0.16, radiusBottom: 0.5 })
  part(body, Vector3.create(0, 3.35, -0.05), Vector3.create(1.05, 1.2, 1.0), COLORS.charcoal, 'sphere') // hood / shoulders
  // Elongated ivory mask with a narrow vertical slit and a luminous eye.
  part(body, Vector3.create(0, 3.45, 0.42), Vector3.create(0.42, 0.95, 0.12), COLORS.ivory, 'box')
  part(body, Vector3.create(0, 3.5, 0.485), Vector3.create(0.05, 0.42, 0.02), COLORS.obsidian, 'box')
  eye = part(body, Vector3.create(0, 3.55, 0.5), Vector3.create(0.07, 0.11, 0.04), COLORS.finalWhite, 'sphere', { emissive: 3 })
  // Long pale hands.
  part(body, Vector3.create(-0.95, 2.3, 0.35), Vector3.create(0.16, 0.45, 0.16), COLORS.ash, 'box')
  part(body, Vector3.create(0.95, 2.3, 0.35), Vector3.create(0.16, 0.45, 0.16), COLORS.ash, 'box')

  // The Archive: three concentric silver rings of beads behind the head, rotating independently.
  const ringSpecs = [
    { radius: 0.85, beads: 10, speed: 18 },
    { radius: 1.2, beads: 14, speed: -11 },
    { radius: 1.55, beads: 18, speed: 7 }
  ]
  for (const spec of ringSpecs) {
    const ring = engine.addEntity()
    Transform.create(ring, { parent: body, position: Vector3.create(0, 3.5, -0.55) })
    for (let i = 0; i < spec.beads; i++) {
      const a = (i / spec.beads) * Math.PI * 2
      part(ring, Vector3.create(Math.cos(a) * spec.radius, Math.sin(a) * spec.radius, 0), Vector3.create(0.1, 0.1, 0.1), COLORS.silver, 'sphere', { emissive: 0.4 })
    }
    rings.push({ entity: ring, speed: spec.speed })
  }

  engine.addSystem(watcherSystem)
}

function watcherSystem(dt: number) {
  const t = state.time

  // Idle levitation.
  const tr = Transform.getMutable(root)
  tr.position.y = BOSS.hoverHeight - 1.5 + Math.sin(t * 1.1) * 0.12

  // Glide-turn to face the player slowly (eye tracking comes later).
  if (Transform.has(engine.PlayerEntity)) {
    const p = Transform.get(engine.PlayerEntity).position
    const dx = p.x - ARENA.center.x
    const dz = p.z - ARENA.center.z
    if (dx * dx + dz * dz > 0.01) {
      const target = Quaternion.fromEulerDegrees(0, (Math.atan2(dx, dz) * 180) / Math.PI, 0)
      tr.rotation = Quaternion.slerp(tr.rotation, target, Math.min(1, dt * 1.5))
    }
  }

  for (const r of rings) {
    const rt = Transform.getMutable(r.entity)
    rt.rotation = Quaternion.multiply(rt.rotation, Quaternion.fromEulerDegrees(0, 0, r.speed * dt))
  }

  // Hit feedback: brief recoil/squash and a brighter eye.
  const flashing = t < state.bossFlashUntil
  const bt = Transform.getMutable(body)
  bt.scale = flashing ? Vector3.create(1.06, 0.97, 1.06) : Vector3.One()
  const eyeMat = Material.getMutableOrNull(eye)
  if (eyeMat && eyeMat.material?.$case === 'pbr') eyeMat.material.pbr.emissiveIntensity = flashing ? 8 : 3
}
