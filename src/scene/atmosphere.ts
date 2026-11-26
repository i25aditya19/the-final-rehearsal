// Chamber atmosphere. The vault hides the sky, so the scene takes control of the environment:
// neutral grey ambient (sky colours), a dim neutral sun with a fixed direction, charcoal fog.
// The client's default time-of-day sky/sun tinted the marble floor orange-red and the silver
// stone pink-lilac (creator screenshots, 2026-11-26); everything here is neutral so the palette
// stays obsidian / charcoal / ash / silver / ivory, with crimson and cyan only from gameplay.
// Scene lights: 5 silver point lights, a key spot on the Watcher, and his rim light (watcher.ts)
// = 7 (mobile budget 8). Sky/Sun/Fog overrides are desktop-only; mobile keeps its sky.
import { EnvironmentFog, LightSource, Skybox, SkyboxTime, Sun, Transform, engine, ColorGradient } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA } from '../config'

export const ATMOSPHERE = {
  /** Seconds since midnight. 48600 = 13:30: neutral light inside the enclosed chamber. */
  skyboxTime: 48600,
  lightIntensity: 36000,
  lightRange: 30,
  /** Ambient grey (sky colours drive the ambient light): readable, never black. */
  ambient: { zenith: 0.2, horizon: 0.16, nadir: 0.1 },
  sunIntensity: 0.45
}

const grey = (v: number, tint = 1.0): ColorGradient => ({ keys: [{ time: 0, color: Color4.create(v, v, v * tint, 1) }] })

export function initAtmosphere() {
  // Runtime SkyboxTime also covers clients that ignore scene.json's fixed time (e.g. mobile).
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: ATMOSPHERE.skyboxTime })
  const A = ATMOSPHERE.ambient
  Skybox.createOrReplace(engine.RootEntity, {
    skyColors: { zenith: grey(A.zenith, 1.04), horizon: grey(A.horizon, 1.03), nadir: grey(A.nadir), rim: grey(A.horizon) },
    clouds: { opacity: 0 },
    stars: { brightness: 0 }
  })
  // Neutral moonlight-white sun from high above, slightly off-axis; no disc or lens flare.
  Sun.createOrReplace(engine.RootEntity, {
    color: grey(1, 1.03),
    intensity: ATMOSPHERE.sunIntensity,
    visible: false,
    direction: Vector3.create(0.25, -1, 0.18)
  })
  EnvironmentFog.createOrReplace(engine.RootEntity, { color: grey(0.05, 1.05), density: 0.004 })

  const r = ARENA.playableRadius * 0.85
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 + 36) * Math.PI) / 180
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(ARENA.center.x + Math.sin(a) * r, 11, ARENA.center.z + Math.cos(a) * r) })
    LightSource.create(e, {
      type: LightSource.Type.Point({}),
      color: Color3.create(0.9, 0.91, 0.94), // neutral silver (was blue-tinted: mixed with warm sky into lilac)
      intensity: ATMOSPHERE.lightIntensity,
      range: ATMOSPHERE.lightRange
    })
  }
  // Key light from the clock above, so the black-robed Watcher reads against the walls.
  const key = engine.addEntity()
  Transform.create(key, { position: Vector3.create(ARENA.center.x, 18, ARENA.center.z), rotation: Quaternion.fromEulerDegrees(90, 0, 0) })
  LightSource.create(key, { type: LightSource.Type.Spot({ innerAngle: 14, outerAngle: 26 }), color: Color3.create(1, 0.99, 0.97), intensity: 90000, range: 30 })
  // (The crimson under-light was removed: it pooled red across the floor. Crimson now comes only
  // from the Watcher's eye and his attacks.)
}
