// Animated chamber pieces (static architecture lives in main.composite):
// - the silver astronomical mechanism overhead (two rings of the Aholo astro_rings model)
// - floating enchanted candles bobbing around the arena edge
import { Entity, GltfContainer, GltfNodeModifiers, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA } from '../config'
import { state } from '../game/state'

const RINGS = 'assets/environment/astro_rings.glb'
const CLOCK = 'assets/environment/astro_clock.glb'
const CLOCK_Y = 25.5
const CLOCK_SCALE = 15 // 0.6 m model -> 9 m
let clock: Entity
let clockAngle = 0
const CANDLE = 'assets/environment/floating_candle.glb'
const CANDLE_COUNT = 24
const CANDLE_SCALE = 2.2 // 0.28 m model -> 0.62 m

const rings: { e: Entity; speed: number; tilt: number; y: number }[] = []
const candles: { body: Entity; flame: Entity; x: number; z: number; base: number; phase: number }[] = []

function gltf(src: string, pos: Vector3, scale: number): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: pos, scale: Vector3.create(scale, scale, scale) })
  GltfContainer.create(e, { src, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  return e
}

export function initChamber() {
  const c = ARENA.center
  // Model is a 0.6 m disc facing +Z; laid flat overhead and turned slowly.
  rings.push({ e: gltf(RINGS, Vector3.create(c.x, CLOCK_Y, c.z), 34), speed: 3, tilt: 0, y: CLOCK_Y })
  rings.push({ e: gltf(RINGS, Vector3.create(c.x, CLOCK_Y - 2.5, c.z), 22), speed: -5, tilt: 12, y: CLOCK_Y - 2.5 })

  // The astronomical clock hangs at the centre beneath the vault apex on a silver chain.
  clock = gltf(CLOCK, Vector3.create(c.x, CLOCK_Y, c.z), CLOCK_SCALE)
  const chainTop = 34.6
  const chainBottom = CLOCK_Y + 0.3 * CLOCK_SCALE
  const chain = engine.addEntity()
  Transform.create(chain, { position: Vector3.create(c.x, (chainTop + chainBottom) / 2, c.z), scale: Vector3.create(0.18, chainTop - chainBottom, 0.18) })
  MeshRenderer.setCylinder(chain)
  Material.setPbrMaterial(chain, { albedoColor: Color4.create(0.78, 0.78, 0.8, 1), roughness: 0.5, castShadows: false })

  // The enclosure must not darken the arena: the wall and vault cast no shadows, so the
  // daylight still models the architecture while the sky stays hidden.
  for (const name of ['Arena/Chamber vault', 'Arena/Chamber wall']) {
    const e = engine.getEntityOrNullByName(name)
    if (e) GltfNodeModifiers.createOrReplace(e, { modifiers: [{ path: '', castShadows: false }] })
    else console.log(`[FinalRehearsal] chamber piece not found: ${name}`)
  }

  const flameColor = Color4.fromHexString('#FFE6C2')
  for (let i = 0; i < CANDLE_COUNT; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / CANDLE_COUNT
    const r = ARENA.playableRadius + 1.4 + (i % 2) * 0.8
    const x = c.x + Math.sin(a) * r
    const z = c.z + Math.cos(a) * r
    const base = 3.6 + (i % 3) * 0.9
    const body = gltf(CANDLE, Vector3.create(x, base, z), CANDLE_SCALE)
    const flame = engine.addEntity()
    Transform.create(flame, { position: Vector3.create(x, base + 0.42, z), scale: Vector3.create(0.09, 0.2, 0.09) })
    MeshRenderer.setSphere(flame)
    Material.setPbrMaterial(flame, { albedoColor: flameColor, emissiveColor: Color3.create(flameColor.r, flameColor.g, flameColor.b), emissiveIntensity: 6 })
    candles.push({ body, flame, x, z, base, phase: i * 1.37 })
  }
  engine.addSystem(chamberSystem)
}

function chamberSystem() {
  const t = state.time
  // The clock turns slowly so its face sweeps the whole chamber.
  // At victory time moves forward again: the clock races.
  if (state.phase === 'victory') clockAngle += 90 * 0.033
  else clockAngle += 4 * 0.033
  if (clock) Transform.getMutable(clock).rotation = Quaternion.fromEulerDegrees(0, clockAngle % 360, 0)
  for (const r of rings) {
    Transform.getMutable(r.e).rotation = Quaternion.multiply(
      Quaternion.fromEulerDegrees(r.tilt * Math.sin(t * 0.1), (t * r.speed) % 360, 0),
      Quaternion.fromEulerDegrees(90, 0, 0)
    )
  }
  for (const k of candles) {
    const y = k.base + Math.sin(t * 0.8 + k.phase) * 0.25
    Transform.getMutable(k.body).position = Vector3.create(k.x, y, k.z)
    const f = Transform.getMutable(k.flame)
    f.position = Vector3.create(k.x, y + 0.42, k.z)
    const flick = 0.2 + 0.03 * Math.sin(t * 7 + k.phase * 3)
    f.scale = Vector3.create(0.09, flick, 0.09)
  }
}
