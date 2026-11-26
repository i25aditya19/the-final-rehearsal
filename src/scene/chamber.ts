// Animated chamber pieces (static architecture lives in main.composite):
// - the celestial clock: a face-down engraved dial (Roman numerals, zodiac band, star field)
//   with two slow hands, inside two clean tilted armillary rings, ivory eye at its heart.
//   (The earlier generated clock read as a tangle from below; see docs/STATUS.md.)
// - floating enchanted candles, hovering ancient books, twinkling vault stars
// All perimeter/overhead: nothing here has colliders or enters the combat floor.
import { Entity, GltfContainer, GltfNodeModifiers, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA } from '../config'
import { state } from '../game/state'

const ENV = 'assets/environment/'
const FX = 'assets/fx/'
const CLOCK_Y = 24.5
const DIAL_RADIUS = 6.2
const NO_SHADOW = { modifiers: [{ path: '', castShadows: false }] }
const CANDLE_COUNT = 24
const CANDLE_SCALE = 2.2
const BOOKS = 12
const STARS = 26
// Vault profile (keep in sync with scripts/asset-pipeline/build_chamber_shell.py)
const R_WALL = 28.2
const H_SPRING = 19
const H_APEX = 35

const rings: { e: Entity; speed: number; tiltX: number; tiltZ: number; angle: number }[] = []
const hands: { e: Entity; speed: number; angle: number }[] = []
const candles: { body: Entity; flame: Entity; x: number; z: number; base: number; phase: number }[] = []
const books: { e: Entity; a: number; r: number; y: number; phase: number; spin: number }[] = []
const stars: { e: Entity; phase: number; base: number }[] = []
let clock: Entity
let clockAngle = 0

function model(src: string, pos: Vector3, scale: number, rotation = Quaternion.Identity()): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: pos, scale: Vector3.create(scale, scale, scale), rotation })
  GltfContainer.create(e, { src, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  return e
}

export function initChamber() {
  const c = ARENA.center
  // Clock mechanism: the dial, two hands beneath it, two armillary rings around it.
  clock = engine.addEntity()
  Transform.create(clock, { position: Vector3.create(c.x, CLOCK_Y, c.z), scale: Vector3.create(DIAL_RADIUS, DIAL_RADIUS, DIAL_RADIUS) })
  GltfContainer.create(clock, { src: ENV + 'celestial_dial.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  GltfNodeModifiers.create(clock, NO_SHADOW)
  for (const [len, y, speed, angle] of [[DIAL_RADIUS * 0.55, 0.08, 0.6, 140], [DIAL_RADIUS * 0.82, 0.14, 5, 20]]) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(c.x, CLOCK_Y - y, c.z), scale: Vector3.create(len * 1.6, 1, len) })
    GltfContainer.create(e, { src: ENV + 'clock_hand.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
    GltfNodeModifiers.create(e, NO_SHADOW)
    hands.push({ e, speed, angle })
  }
  for (const [radius, speed, tiltX, tiltZ, angle] of [[8.2, 2.2, 16, 0, 0], [10.4, -1.4, 0, -11, 60]]) {
    const e = model(ENV + 'armillary_ring.glb', Vector3.create(c.x, CLOCK_Y - 0.6, c.z), radius)
    GltfNodeModifiers.create(e, NO_SHADOW)
    rings.push({ e, speed, tiltX, tiltZ, angle })
  }
  // The Watcher's emblem at the heart of the dial: an ivory eye with a crimson pupil, looking down.
  model(FX + 'orb_ivory.glb', Vector3.create(c.x, CLOCK_Y - 0.35, c.z), 1.1)
  model(FX + 'orb_crimson.glb', Vector3.create(c.x, CLOCK_Y - 0.88, c.z), 0.42)
  // Silver chain to the apex.
  const chainTop = 34.6
  const chainBottom = CLOCK_Y + 0.8
  const chain = engine.addEntity()
  Transform.create(chain, { position: Vector3.create(c.x, (chainTop + chainBottom) / 2, c.z), scale: Vector3.create(0.18, chainTop - chainBottom, 0.18) })
  MeshRenderer.setCylinder(chain)
  Material.setPbrMaterial(chain, { albedoColor: Color4.create(0.7, 0.7, 0.72, 1), roughness: 0.6, castShadows: false })

  // The enclosure must not darken the arena: wall, vault and parapet cast no shadows.
  for (const name of ['Arena/Chamber vault', 'Arena/Chamber wall', 'Arena/Parapet']) {
    const e = engine.getEntityOrNullByName(name)
    if (e) GltfNodeModifiers.createOrReplace(e, { modifiers: [{ path: '', castShadows: false }] })
    else console.log(`[FinalRehearsal] chamber piece not found: ${name}`)
  }

  // Floating candles with small white flames (shared low-poly orb, no sphere primitives).
  for (let i = 0; i < CANDLE_COUNT; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / CANDLE_COUNT
    const r = ARENA.playableRadius + 1.4 + (i % 2) * 0.8
    const x = c.x + Math.sin(a) * r
    const z = c.z + Math.cos(a) * r
    const base = 3.6 + (i % 3) * 0.9
    const body = model(ENV + 'floating_candle.glb', Vector3.create(x, base, z), CANDLE_SCALE)
    const flame = model(FX + 'orb_flame.glb', Vector3.create(x, base + 0.42, z), 0.11)
    candles.push({ body, flame, x, z, base, phase: i * 1.37 })
  }

  // Ancient books drifting slowly between the parapet and the pillars.
  for (let i = 0; i < BOOKS; i++) {
    const a = (i / BOOKS) * Math.PI * 2 + 0.13
    const e = model(ENV + 'book.glb', Vector3.create(c.x, 6, c.z), 2.4)
    books.push({ e, a, r: ARENA.playableRadius + 4.2, y: 5.5 + (i % 4) * 1.1, phase: i * 0.83, spin: (i % 2 ? 1 : -1) * (8 + i) })
  }

  // Twinkling stars set into the vault (the constellations themselves are in its texture).
  for (let i = 0; i < STARS; i++) {
    const t = 0.15 + ((i * 0.6180339) % 1) * 0.75
    const ang = i * 2.399963
    const r = R_WALL * (1 - t) - 0.6
    const h = H_SPRING + (H_APEX - H_SPRING) * Math.pow(Math.sin((t * Math.PI) / 2), 0.85) - 0.6
    const e = model(FX + 'orb_white.glb', Vector3.create(c.x + Math.sin(ang) * r, h, c.z + Math.cos(ang) * r), 0.22)
    stars.push({ e, phase: i * 1.91, base: 0.22 })
  }
  engine.addSystem(chamberSystem)
}

function chamberSystem(dt: number) {
  const t = state.time
  const step = Math.min(dt, 0.1)
  const victory = state.phase === 'victory'
  // At victory time moves forward again: the mechanism races.
  // Slow, elegant movement; at victory the hands and rings race.
  const race = victory ? 12 : 1
  clockAngle = (clockAngle + 1.2 * race * step) % 360
  if (clock) Transform.getMutable(clock).rotation = Quaternion.fromEulerDegrees(0, clockAngle, 0)
  for (const h of hands) {
    h.angle = (h.angle + h.speed * race * step) % 360
    Transform.getMutable(h.e).rotation = Quaternion.fromEulerDegrees(0, h.angle, 0)
  }
  for (const r of rings) {
    r.angle = (r.angle + r.speed * race * step) % 360
    const wob = 1 + 0.15 * Math.sin(t * 0.12 + r.angle * 0.01)
    Transform.getMutable(r.e).rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(r.tiltX * wob, 0, r.tiltZ * wob), Quaternion.fromEulerDegrees(0, r.angle, 0))
  }
  for (const k of candles) {
    const y = k.base + Math.sin(t * 0.8 + k.phase) * 0.25
    Transform.getMutable(k.body).position = Vector3.create(k.x, y, k.z)
    const f = Transform.getMutable(k.flame)
    f.position = Vector3.create(k.x, y + 0.42, k.z)
    const flick = 0.11 * (1 + 0.15 * Math.sin(t * 7 + k.phase * 3))
    f.scale = Vector3.create(0.09, flick * 1.8, 0.09)
  }
  const c = ARENA.center
  for (const b of books) {
    b.a += 0.02 * step
    const tr = Transform.getMutable(b.e)
    tr.position = Vector3.create(c.x + Math.sin(b.a) * b.r, b.y + Math.sin(t * 0.6 + b.phase) * 0.35, c.z + Math.cos(b.a) * b.r)
    tr.rotation = Quaternion.fromEulerDegrees(Math.sin(t * 0.4 + b.phase) * 12, (t * b.spin) % 360, Math.cos(t * 0.3 + b.phase) * 8)
  }
  for (const s of stars) {
    const k = s.base * (0.6 + 0.4 * Math.max(0, Math.sin(t * 1.3 + s.phase)) ** 3)
    Transform.getMutable(s.e).scale = Vector3.create(k, k, k)
  }
}
