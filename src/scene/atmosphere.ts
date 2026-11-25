// Chamber atmosphere. The sky is hidden by the vault, so a neutral early-afternoon sun (with the
// vault and wall casting no shadows) gives even, readable light; silver point lights add depth,
// a key light keeps the Watcher distinct, a low crimson glow marks him as the threat.
// 7 lights in total (mobile budget 8).
import { LightSource, SkyboxTime, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, BOSS } from '../config'

export const ATMOSPHERE = {
  /** Seconds since midnight. 48600 = 13:30: neutral light inside the enclosed chamber. */
  skyboxTime: 48600,
  lightIntensity: 42000,
  lightRange: 30
}

export function initAtmosphere() {
  // Runtime SkyboxTime also covers clients that ignore scene.json's fixed time (e.g. mobile).
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: ATMOSPHERE.skyboxTime })

  const r = ARENA.playableRadius * 0.85
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 + 36) * Math.PI) / 180
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(ARENA.center.x + Math.sin(a) * r, 11, ARENA.center.z + Math.cos(a) * r) })
    LightSource.create(e, {
      type: LightSource.Type.Point({}),
      color: Color3.create(0.78, 0.84, 0.95), // moonlight silver
      intensity: ATMOSPHERE.lightIntensity,
      range: ATMOSPHERE.lightRange
    })
  }
  // Key light from the clock above, so the black-robed Watcher reads against the walls.
  const key = engine.addEntity()
  Transform.create(key, { position: Vector3.create(ARENA.center.x, 18, ARENA.center.z), rotation: Quaternion.fromEulerDegrees(90, 0, 0) })
  LightSource.create(key, { type: LightSource.Type.Spot({ innerAngle: 16, outerAngle: 30 }), color: Color3.create(0.95, 0.95, 1), intensity: 90000, range: 30 })
  // Low crimson glow under the Watcher.
  const under = engine.addEntity()
  Transform.create(under, { position: Vector3.create(ARENA.center.x, 0.8, ARENA.center.z) })
  LightSource.create(under, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0.77, 0.13, 0.25),
    intensity: 9000,
    range: BOSS.hitRadius * 4
  })
}
