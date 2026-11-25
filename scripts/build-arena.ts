/**
 * Writes the greybox arena (floor engravings, sector lines, boundary wall, pillars) into
 * assets/scene/main.composite, sized from src/config.ts.
 *
 * Static scenery belongs in the composite (Decentraland "composite-first" rule), so it loads
 * fast and stays editable in the Creator Hub. Re-run after changing ARENA values:
 *   npm run arena
 * Only entities named "Arena..." are replaced; everything else in the composite is preserved.
 * Do not run while the scene is open in the Creator Hub (it would overwrite the file on save).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { ARENA, COLORS } from '../src/config'

const COMPOSITE = 'assets/scene/main.composite'
const PREFIX = 'Arena'

type Json = any
const composite: Json = JSON.parse(readFileSync(COMPOSITE, 'utf8'))

function component(name: string, jsonSchema?: Json): Json {
  let c = composite.components.find((x: Json) => x.name === name)
  if (!c) {
    c = jsonSchema ? { name, jsonSchema, data: {} } : { name, data: {} }
    composite.components.push(c)
  }
  return c
}

const NameC = component('core-schema::Name', {
  type: 'object',
  properties: { value: { type: 'string', serializationType: 'utf8-string' } },
  serializationType: 'map'
})
const TransformC = component('core::Transform')
const MeshC = component('core::MeshRenderer')
const MaterialC = component('core::Material')
const ColliderC = component('core::MeshCollider')
const NodesC = component('inspector::Nodes')

// ---- remove previous arena entities -------------------------------------------------------
const old = new Set<string>(
  Object.entries(NameC.data)
    .filter(([, v]: [string, Json]) => String(v.json.value).startsWith(PREFIX))
    .map(([k]) => k)
)
for (const c of composite.components) for (const id of old) delete c.data[id]
const nodes: Json[] = NodesC.data['0'].json.value
NodesC.data['0'].json.value = nodes.filter((n) => !old.has(String(n.entity)))
for (const n of NodesC.data['0'].json.value) n.children = n.children.filter((ch: number) => !old.has(String(ch)))

// ---- id allocation -------------------------------------------------------------------------
let nextId = 512
for (const c of composite.components) for (const id of Object.keys(c.data)) nextId = Math.max(nextId, Number(id) + 1)

function hex(c: string, a = 1) {
  const n = parseInt(c.replace('#', ''), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a }
}

function quatY(deg: number) {
  const r = (deg * Math.PI) / 360
  return { x: 0, y: Math.sin(r), z: 0, w: Math.cos(r) }
}

type Spec = {
  name: string
  mesh: 'box' | 'cylinder'
  pos: [number, number, number]
  scale: [number, number, number]
  rotY?: number
  color: string
  emissive?: number
  /** 0 none, 2 physics */
  collider?: 0 | 2
  parent: number
}

function addNode(id: number, parent: number) {
  const list: Json[] = NodesC.data['0'].json.value
  list.push({ entity: id, children: [] })
  const p = list.find((n) => n.entity === parent)
  p.children.push(id)
}

function make(spec: Spec): number {
  const id = nextId++
  NameC.data[id] = { json: { value: spec.name } }
  TransformC.data[id] = {
    json: {
      position: { x: spec.pos[0], y: spec.pos[1], z: spec.pos[2] },
      scale: { x: spec.scale[0], y: spec.scale[1], z: spec.scale[2] },
      rotation: quatY(spec.rotY ?? 0),
      parent: spec.parent
    }
  }
  MeshC.data[id] = {
    json: { mesh: spec.mesh === 'box' ? { $case: 'box', box: { uvs: [] } } : { $case: 'cylinder', cylinder: { radiusTop: 0.5, radiusBottom: 0.5 } } }
  }
  const pbr: Json = { albedoColor: hex(spec.color), metallic: 0, roughness: 0.85 }
  if (spec.emissive) {
    const c = hex(spec.color)
    pbr.emissiveColor = { r: c.r, g: c.g, b: c.b }
    pbr.emissiveIntensity = spec.emissive
  }
  MaterialC.data[id] = { json: { material: { $case: 'pbr', pbr } } }
  if (spec.collider === 2) {
    ColliderC.data[id] = { json: { collisionMask: 2, mesh: spec.mesh === 'box' ? { $case: 'box', box: {} } : { $case: 'cylinder', cylinder: { radiusTop: 0.5, radiusBottom: 0.5 } } } }
  }
  addNode(id, spec.parent)
  return id
}

// ---- arena root ------------------------------------------------------------------------------
const cx = ARENA.center.x
const cz = ARENA.center.z
const R = ARENA.playableRadius
const wallR = R + ARENA.borderMargin

const root = nextId++
NameC.data[root] = { json: { value: PREFIX } }
TransformC.data[root] = {
  json: { position: { x: cx, y: 0, z: cz }, scale: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, parent: 0 }
}
addNode(root, 0)

// Floor: stacked thin discs (largest first, each slightly higher) give engraved concentric rings
// without textures. Visual only: the player walks on the scene ground at y=0.
const FLOOR_BASE = '#3A3A3A'
const LINE = COLORS.silver
let y = 0.004
const disc = (name: string, radius: number, color: string, emissive?: number) => {
  make({ name: `${PREFIX}/${name}`, mesh: 'cylinder', pos: [0, y, 0], scale: [radius * 2, 0.008, radius * 2], color, emissive, parent: root })
  y += 0.004
}
disc('Apron', wallR + 1.5, COLORS.obsidian)
disc('EdgeLine', R + 0.12, LINE, 0.15)
disc('Floor', R, FLOOR_BASE)
for (const r of [R * 0.75, R * 0.5]) {
  disc(`Ring ${r.toFixed(1)} line`, r + 0.06, LINE, 0.15)
  disc(`Ring ${r.toFixed(1)}`, r, FLOOR_BASE)
}
disc('Dais line', ARENA.daisRadius + 0.12, LINE, 0.25)
disc('Dais', ARENA.daisRadius, COLORS.charcoal)

// Sector boundaries on the diagonals (sectors are centred on N/E/S/W).
const lineLen = R - ARENA.daisRadius
for (let i = 0; i < ARENA.sectorCount; i++) {
  const deg = 45 + i * (360 / ARENA.sectorCount)
  const mid = ARENA.daisRadius + lineLen / 2
  const rad = (deg * Math.PI) / 180
  make({
    name: `${PREFIX}/Sector boundary ${i}`,
    mesh: 'box',
    pos: [Math.sin(rad) * mid, y + 0.002, Math.cos(rad) * mid],
    scale: [0.12, 0.01, lineLen],
    rotY: deg,
    color: LINE,
    emissive: 0.2,
    parent: root
  })
}
y += 0.004

// Sector rune plates: a diamond at each cardinal direction to help players read position.
const sectorNames = ['North', 'East', 'South', 'West']
for (let i = 0; i < ARENA.sectorCount; i++) {
  const deg = i * (360 / ARENA.sectorCount)
  const rad = (deg * Math.PI) / 180
  const r = R * 0.875
  make({
    name: `${PREFIX}/Rune ${sectorNames[i] ?? i}`,
    mesh: 'box',
    pos: [Math.sin(rad) * r, y + 0.002, Math.cos(rad) * r],
    scale: [1.1, 0.01, 1.1],
    rotY: deg + 45,
    color: COLORS.ivory,
    emissive: 0.35,
    parent: root
  })
}

// Boundary wall: polygon of solid segments just outside the playable floor.
const segments = 48
const segLen = 2 * wallR * Math.tan(Math.PI / segments) + 0.1
for (let i = 0; i < segments; i++) {
  const deg = (i + 0.5) * (360 / segments)
  const rad = (deg * Math.PI) / 180
  make({
    name: `${PREFIX}/Wall ${i}`,
    mesh: 'box',
    pos: [Math.sin(rad) * wallR, 1.5, Math.cos(rad) * wallR],
    scale: [segLen, 3, 0.7],
    rotY: deg,
    color: COLORS.stone,
    collider: 2,
    parent: root
  })
}

// Wall coping: a thin silver line along the top of the wall (reads the boundary at dusk).
for (let i = 0; i < segments; i++) {
  const deg = (i + 0.5) * (360 / segments)
  const rad = (deg * Math.PI) / 180
  make({
    name: `${PREFIX}/Coping ${i}`,
    mesh: 'box',
    pos: [Math.sin(rad) * wallR, 3.05, Math.cos(rad) * wallR],
    scale: [segLen, 0.12, 0.8],
    rotY: deg,
    color: COLORS.silver,
    emissive: 0.25,
    parent: root
  })
}

// Pillars: tall columns behind the wall with a capital and a candle flame (gothic placeholder
// until the modular chamber kit; see GAME_DESIGN 13).
const pillarCount = 12
for (let i = 0; i < pillarCount; i++) {
  const deg = i * (360 / pillarCount) + 15
  const rad = (deg * Math.PI) / 180
  const r = wallR + 1.6
  const x = Math.sin(rad) * r
  const z = Math.cos(rad) * r
  make({ name: `${PREFIX}/Pillar ${i}`, mesh: 'cylinder', pos: [x, 7, z], scale: [1.6, 14, 1.6], color: COLORS.charcoal, collider: 2, parent: root })
  make({ name: `${PREFIX}/Pillar base ${i}`, mesh: 'cylinder', pos: [x, 0.4, z], scale: [2.3, 0.8, 2.3], color: COLORS.stone, parent: root })
  make({ name: `${PREFIX}/Pillar capital ${i}`, mesh: 'cylinder', pos: [x, 14.2, z], scale: [2.3, 0.5, 2.3], color: COLORS.stone, parent: root })
  // Candle on a bracket facing the arena.
  const cr = r - 1.25
  make({ name: `${PREFIX}/Candle ${i}`, mesh: 'cylinder', pos: [Math.sin(rad) * cr, 4.2, Math.cos(rad) * cr], scale: [0.22, 0.7, 0.22], color: COLORS.ivory, parent: root })
  make({ name: `${PREFIX}/Candle flame ${i}`, mesh: 'cylinder', pos: [Math.sin(rad) * cr, 4.7, Math.cos(rad) * cr], scale: [0.1, 0.25, 0.1], color: '#FFE2B0', emissive: 4, parent: root })
}

writeFileSync(COMPOSITE, JSON.stringify(composite, null, 2) + '\n')
console.log(`Arena written: ${nextId - root} entities (ids ${root}..${nextId - 1}), playable radius ${R} m, wall at ${wallR} m`)
