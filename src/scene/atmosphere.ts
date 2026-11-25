// Chamber atmosphere: fixed dusk sky (so glowing magic reads strongly while the floor stays
// visible) and a few cool point lights. Lights are kept to 5 (mobile budget is 8).
import { LightSource, SkyboxTime, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Vector3 } from '@dcl/sdk/math'
import { ARENA, BOSS } from '../config'

export const ATMOSPHERE = {
  /** Seconds since midnight. 70200 = 19:30 (dusk). Lower toward 86400/0 for a darker night. */
  skyboxTime: 70200,
  lightIntensity: 26000,
  lightRange: 26
}

export function initAtmosphere() {
  // Runtime SkyboxTime also covers clients that ignore scene.json's fixed time (e.g. mobile).
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: ATMOSPHERE.skyboxTime })

  const r = ARENA.playableRadius * 0.7
  for (let i = 0; i < 4; i++) {
    const a = ((i * 90 + 45) * Math.PI) / 180
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(ARENA.center.x + Math.sin(a) * r, 9, ARENA.center.z + Math.cos(a) * r) })
    LightSource.create(e, {
      type: LightSource.Type.Point({}),
      color: Color3.create(0.78, 0.84, 0.95), // moonlight silver
      intensity: ATMOSPHERE.lightIntensity,
      range: ATMOSPHERE.lightRange
    })
  }
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
