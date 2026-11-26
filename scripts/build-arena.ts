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
const GltfC = component('core::GltfContainer')
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
  mesh: 'box' | 'cylinder' | 'none'
  /** GLB model instead of a primitive (no mesh colliders: use simple primitives for collision). */
  gltf?: string
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
  if (spec.gltf) {
    GltfC.data[id] = { json: { src: spec.gltf, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 } }
  } else if (spec.mesh !== 'none') {
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
  }
  if (spec.collider === 2) {
    ColliderC.data[id] = { json: { collisionMask: 2, mesh: spec.mesh === 'box' ? { $case: 'box', box: {} } : { $case: 'cylinder', cylinder: { radiusTop: 0.5, radiusBottom: 0.5 } } } }
    if (spec.mesh === 'none') throw new Error('collider needs a primitive shape')
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
// Astronomical marble floor (procedural, scripts/asset-pipeline/build_chamber_shell.py): the
// gameplay rings (0.75 R, 0.5 R), the playable edge, zodiac ring and dais are baked into it.
make({ name: `${PREFIX}/Marble floor`, mesh: 'none', gltf: 'assets/environment/chamber_floor.glb', pos: [0, 0.003, 0], scale: [1, 1, 1], color: '', parent: root })
void disc

// Sector lines, N/E/S/W runes and the playable edge are engraved in the marble floor texture.

// Boundary: carved low parapet (1.6 m visual, procedural) plus an invisible 2.8 m collision ring
// so the combat boundary is unchanged and cannot be jumped.
make({ name: `${PREFIX}/Parapet`, mesh: 'none', gltf: 'assets/environment/chamber_parapet.glb', pos: [0, 0, 0], scale: [1, 1, 1], color: '', parent: root })
const colSegs = 32
const colLen = 2 * wallR * Math.tan(Math.PI / colSegs) + 0.2
for (let i = 0; i < colSegs; i++) {
  const deg = (i + 0.5) * (360 / colSegs)
  const rad = (deg * Math.PI) / 180
  make({ name: `${PREFIX}/Boundary collider ${i}`, mesh: 'box', pos: [Math.sin(rad) * wallR, 1.4, Math.cos(rad) * wallR], scale: [colLen, 2.8, 0.7], rotY: deg, color: '', collider: 2, parent: root })
}

// ---------------------------------------------------------------- Chamber of Unforgotten Moments
// Aholo models (optimized copies in assets/environment). Model origins are at their centres,
// +Z is the front. Every architectural piece faces the arena centre. Collision uses simple
// invisible primitives, never the meshes.
const ENV = 'assets/environment/'
const ring = wallR + 1.8 // pillar/arch circle
const faceCentre = (deg: number) => deg + 180
const DOOR_DEG = 180 // grand entrance behind the south spawn
const pillarCount = 12

for (let i = 0; i < pillarCount; i++) {
  const deg = i * (360 / pillarCount) + 15
  const rad = (deg * Math.PI) / 180
  const x = Math.sin(rad) * ring
  const z = Math.cos(rad) * ring
  // gothic_pillar: 2.4 m tall model -> 13.2 m.
  make({ name: `${PREFIX}/Pillar ${i}`, mesh: 'none', gltf: ENV + 'gothic_pillar.glb', pos: [x, 6.6, z], scale: [5.5, 5.5, 5.5], rotY: faceCentre(deg), color: '', parent: root })
  make({ name: `${PREFIX}/Pillar collider ${i}`, mesh: 'cylinder', pos: [x, 6.6, z], scale: [3.2, 13.2, 3.2], color: '', collider: 2, parent: root })
}
// Delete the visual of the collider-only cylinders (keep their colliders).
for (const [id, v] of Object.entries(NameC.data) as [string, Json][]) {
  if (String(v.json.value).startsWith(`${PREFIX}/Pillar collider`) || String(v.json.value).startsWith(`${PREFIX}/Boundary collider`)) {
    delete MeshC.data[id]
    delete MaterialC.data[id]
  }
}

for (let i = 0; i < pillarCount; i++) {
  const deg = i * (360 / pillarCount)
  const rad = (deg * Math.PI) / 180
  const x = Math.sin(rad) * ring
  const z = Math.cos(rad) * ring
  if (deg === DOOR_DEG) {
    // Grand entrance: chamber_door (3.5 m model -> 10.5 m) inside an arch frame.
    const dr = ring + 2.2
    make({ name: `${PREFIX}/Grand door`, mesh: 'none', gltf: ENV + 'chamber_door.glb', pos: [Math.sin(rad) * dr, 5.25, Math.cos(rad) * dr], scale: [3, 3, 3], rotY: faceCentre(deg), color: '', parent: root })
  }
  // gothic_arch: 4.5 m model -> 13.5 m, spanning the gap between pillars.
  make({ name: `${PREFIX}/Arch ${i}`, mesh: 'none', gltf: ENV + 'gothic_arch.glb', pos: [x, 6.75, z], scale: [3, 3, 3], rotY: faceCentre(deg), color: '', parent: root })
  if (deg !== DOOR_DEG && i % 3 !== 1) {
    // Monochrome stained glass behind the arch (4 m model -> 10.4 m), softly self-lit.
    const wr = ring + 2.6
    make({ name: `${PREFIX}/Window ${i}`, mesh: 'none', gltf: ENV + 'gothic_window.glb', pos: [Math.sin(rad) * wr, 6.2, Math.cos(rad) * wr], scale: [2.6, 2.6, 2.6], rotY: faceCentre(deg), color: '', parent: root })
  } else if (deg !== DOOR_DEG) {
    // Spectral silhouettes of past sorcerers, frozen in their final spells (distinct from echoes:
    // grey, translucent, set back in the archways).
    const sr = ring + 1.4
    make({ name: `${PREFIX}/Silhouette ${i}`, mesh: 'none', gltf: ENV + 'wall_silhouette.glb', pos: [Math.sin(rad) * sr, 2.9, Math.cos(rad) * sr], scale: [2.6, 2.6, 2.6], rotY: faceCentre(deg), color: '', parent: root })
  }
}

// Enclosure: continuous ashlar wall to the springing line and a pointed ribbed vault with a
// gallery ledge joining the pillar and arch tops to the wall (procedural, see
// scripts/asset-pipeline/build_chamber_shell.py). No colliders: the low wall bounds the fight.
make({ name: `${PREFIX}/Chamber wall`, mesh: 'none', gltf: 'assets/environment/chamber_wall.glb', pos: [0, 0, 0], scale: [1, 1, 1], color: '', parent: root })
make({ name: `${PREFIX}/Chamber vault`, mesh: 'none', gltf: 'assets/environment/chamber_vault.glb', pos: [0, 0, 0], scale: [1, 1, 1], color: '', parent: root })

writeFileSync(COMPOSITE, JSON.stringify(composite, null, 2) + '\n')
console.log(`Arena written: ${nextId - root} entities (ids ${root}..${nextId - 1}), playable radius ${R} m, wall at ${wallR} m`)
