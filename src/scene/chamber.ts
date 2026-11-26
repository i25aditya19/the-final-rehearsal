// Animated chamber pieces (static architecture lives in main.composite):
// - the celestial clock: a face-down engraved dial (Roman numerals, zodiac band, star field)
//   with two slow hands, inside two clean tilted armillary rings, ivory eye at its heart.
//   (The earlier generated clock read as a tangle from below; see docs/STATUS.md.)
// - floating enchanted candles, hovering ancient books, twinkling vault stars
// All perimeter/overhead: nothing here has colliders or enters the combat floor.
import { ColliderLayer, Entity, GltfContainer, GltfNodeModifiers, Material, MeshCollider, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA } from '../config'
import { state } from '../game/state'
import { attackDebug } from '../boss/attacks'
import { autoCull } from '../effects/visibility'

const ENV = 'assets/environment/'
const FX = 'assets/fx/'
const CLOCK_Y = 24.5
const DIAL_RADIUS = 6.2
const NO_SHADOW = { modifiers: [{ path: '', castShadows: false }] }
const FACE_DOWN = Quaternion.fromEulerDegrees(90, 0, 0) // generated models face +Z
const ornate: { e: Entity; speed: number; angle: number }[] = []
const CANDLE_COUNT = 24
const CANDLE_SCALE = 2.2
const BOOKS = 12
const STARS = 26
// Vault profile (keep in sync with scripts/asset-pipeline/build_chamber_shell.py)
const R_WALL = 28.2
const H_SPRING = 19
const H_APEX = 35

const rings: { e: Entity; speed: number; tiltX: number; tiltZ: number; angle: number; base?: number }[] = []
const hands: { e: Entity; speed: number; angle: number }[] = []
const EYES = 12
const eyes: { white: Entity; pupil: Entity; open: number; delay: number }[] = []
// Clock behaviour state: the hands keep rewinding to the same moment until victory.
let loopT = 0
let race = 1
let unstable = 0
let align = 0
let seenFlash = 0
let seenConv = 0
let ringGrow = 1
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
  initFloor()
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
  // Blend with the original ornate mechanism: the generated metallic clock and ring sit behind the
  // dial as a large silver backplate (their busy centres hidden by the dial), slowly counter-turning.
  for (const [src, scale, y, speed] of [['astro_clock.glb', 27, 1.45, -0.8], ['astro_rings.glb', 31, 2.6, 0.5]] as const) {
    const e = model(ENV + src, Vector3.create(c.x, CLOCK_Y + y, c.z), scale, FACE_DOWN)
    GltfNodeModifiers.create(e, NO_SHADOW)
    ornate.push({ e, speed, angle: 0 })
  }
  for (const [radius, speed, tiltX, tiltZ, angle] of [[10.0, 2.2, 14, 0, 0], [12.4, -1.4, 0, -9, 60]]) {
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
    const base = 3.2 + ((i * 7) % 5) * 1.15 // several heights, 3.2-7.8 m
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
  // Moonlight through the stained glass: a soft shaft leaning from every window into the chamber.
  for (let i = 0; i < 12; i++) {
    const deg = i * 30
    if (deg === 180 || i % 3 === 1) continue
    const rad = (deg * Math.PI) / 180
    const r = 26.6
    const e = model(ENV + 'light_shaft.glb', Vector3.create(c.x + Math.sin(rad) * r, 11.2, c.z + Math.cos(rad) * r), 11, Quaternion.fromEulerDegrees(0, deg + 180, 0))
    GltfNodeModifiers.create(e, NO_SHADOW)
  }
  // The chamber's eyes: closed (hidden) until phase III, when the room itself starts watching.
  for (let i = 0; i < EYES; i++) {
    const deg = i * (360 / EYES) + 15
    const rad = (deg * Math.PI) / 180
    const r = 25.4
    const pos = Vector3.create(c.x + Math.sin(rad) * r, 12.2 + (i % 2) * 1.2, c.z + Math.cos(rad) * r)
    const toC = Vector3.normalize(Vector3.create(c.x - pos.x, 4 - pos.y, c.z - pos.z))
    const white = model(FX + 'orb_ivory.glb', pos, 0)
    const pupil = model(FX + 'orb_crimson.glb', Vector3.add(pos, Vector3.scale(toC, 0.42)), 0)
    eyes.push({ white, pupil, open: 0, delay: (i % EYES) * 0.17 })
    autoCull(white, pupil)
  }
  engine.addSystem(chamberSystem)
}

function chamberSystem(dt: number) {
  const t = state.time
  const step = Math.min(dt, 0.1)
  const victory = state.phase === 'victory'
  // The mechanism is bound to the Watcher. Its hands sweep forward a little, then rewind to the
  // same moment (the rehearsal repeating). It races during phase transitions, shudders when he
  // takes a heavy blow, its rings align on a perfect four-echo Convergence, and at victory time
  // finally moves forward normally.
  const transition = state.stage === 'transition'
  const targetRace = victory ? 1 : transition ? 7 : 1
  race += (targetRace - race) * Math.min(1, step * 2)
  if (state.bossFlashUntil !== seenFlash) {
    seenFlash = state.bossFlashUntil
    if (state.lastConvergence && state.time - state.lastConvergence.at < 0.2 && state.lastConvergence.hits >= 3) unstable = 0.8
  }
  if (state.convergences !== seenConv) {
    seenConv = state.convergences
    if (state.lastConvergence && state.lastConvergence.hits >= 4) align = 2.2
  }
  unstable = Math.max(0, unstable - step)
  align = Math.max(0, align - step)
  ringGrow += ((state.bossPhase === 3 && !victory ? 1.22 : 1) - ringGrow) * Math.min(1, step * 0.8)
  const shake = unstable > 0 ? Math.sin(t * 47) * 2.2 * unstable : 0
  clockAngle = (clockAngle + 1.2 * race * step) % 360
  if (clock) Transform.getMutable(clock).rotation = Quaternion.fromEulerDegrees(shake * 0.3, clockAngle, shake * 0.3)
  // rewind loop: 9 s forward, 0.9 s eased back (never at victory)
  const LOOP = 9.9
  loopT = victory ? 0 : (loopT + step * race) % LOOP
  const sweep = loopT < 9 ? loopT / 9 : 1 - smooth((loopT - 9) / 0.9)
  for (const h of hands) {
    if (victory) h.angle = (h.angle + h.speed * 0.5 * step) % 360
    const ang = victory ? h.angle : h.angle + sweep * h.speed * 6 + shake
    Transform.getMutable(h.e).rotation = Quaternion.fromEulerDegrees(0, ang, 0)
  }
  for (const o of ornate) {
    o.angle = (o.angle + o.speed * race * step) % 360
    Transform.getMutable(o.e).rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(0, o.angle, 0), FACE_DOWN)
  }
  for (const r of rings) {
    r.angle = (r.angle + r.speed * race * step) % 360
    const wob = (1 + 0.15 * Math.sin(t * 0.12 + r.angle * 0.01)) * (1 - Math.min(1, align)) + shake * 0.05
    const rt = Transform.getMutable(r.e)
    rt.rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(r.tiltX * wob, 0, r.tiltZ * wob), Quaternion.fromEulerDegrees(0, r.angle, 0))
    if (r.base === undefined) r.base = rt.scale.x
    const k = r.base * ringGrow
    rt.scale = Vector3.create(k, k, k)
  }
  // The chamber's eyes open in phase III, burn during the Final Observation, close at victory.
  const watching = state.bossPhase === 3 && state.phase === 'active'
  const observing = attackDebug().kind === 'observation'
  for (const e of eyes) {
    e.open += ((watching ? 1 : 0) - e.open) * Math.min(1, step * (watching ? 1.5 : 4))
    const delayed = watching ? Math.max(0, Math.min(1, e.open * 1.6 - e.delay)) : e.open
    const blink = Math.sin(t * 0.7 + e.delay * 20) > 0.985 ? 0.15 : 1
    const kw = 0.85 * delayed
    Transform.getMutable(e.white).scale = Vector3.create(kw, kw * blink, kw)
    const kp = 0.34 * delayed * (observing ? 1.35 + 0.15 * Math.sin(t * 9) : 1)
    Transform.getMutable(e.pupil).scale = Vector3.create(kp, kp * blink, kp)
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

/** Height of the walkable marble floor. */
export const FLOOR_Y = ARENA.floorY

// The marble floor as an SDK plane with the floor texture. The GLB floor rendered as the client's
// red default ground in the desktop explorer (creator screenshots, 2026-11-26) even when raised;
// built-in primitives always render. Slightly self-lit so the engraved rings and the eye read in
// the dark, and it carries a collider so players walk on it, above any default ground.
function initFloor() {
  const c = ARENA.center
  const size = 56.4 // chamber wall diameter; the square's corners hide behind the wall
  const floor = engine.addEntity()
  Transform.create(floor, {
    position: Vector3.create(c.x, FLOOR_Y, c.z),
    rotation: Quaternion.fromEulerDegrees(90, 0, 0),
    scale: Vector3.create(size, size, 1)
  })
  MeshRenderer.setPlane(floor)
  MeshCollider.setPlane(floor, ColliderLayer.CL_PHYSICS)
  const tex = Material.Texture.Common({ src: 'assets/images/chamber_floor.jpg' })
  Material.setPbrMaterial(floor, {
    texture: tex,
    emissiveTexture: tex,
    emissiveColor: Color3.create(1, 1, 1),
    emissiveIntensity: 0.35,
    metallic: 0,
    roughness: 0.82,
    castShadows: false
  })
}

const smooth = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k) }
