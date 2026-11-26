// Usage: node smoothmat.mjs in.glb out.glb [--smooth N] [--rough R] [--metal M] [--emissive F]
// --smooth N : Taubin smoothing iterations on positions (welded by position so UV seams stay closed),
//              removes the crumpled "foil" micro-geometry of AI-generated meshes without shrinking.
// --rough/--metal : override roughness/metallic factors on every material.
// --emissive F : emissive = base colour texture * F (self-lit, e.g. an ivory mask readable in shadow).
import { NodeIO } from '@gltf-transform/core'
import { normals } from '@gltf-transform/functions'
const args = process.argv.slice(2)
const [input, output] = args
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d }
const N = opt('--smooth', 0), R = opt('--rough', NaN), M = opt('--metal', NaN), E = opt('--emissive', NaN)
const io = new NodeIO()
const doc = await io.read(input)
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  if (!N) continue
  const pos = prim.getAttribute('POSITION'), idx = prim.getIndices()
  const n = pos.getCount(), P = pos.getArray()
  const key = new Map(), weld = new Int32Array(n); let u = 0
  for (let i = 0; i < n; i++) { const k = `${P[3*i].toFixed(5)},${P[3*i+1].toFixed(5)},${P[3*i+2].toFixed(5)}`; let w = key.get(k); if (w === undefined) { w = u++; key.set(k, w) } weld[i] = w }
  const V = new Float64Array(u * 3); for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) V[3*weld[i]+c] = P[3*i+c]
  const nb = Array.from({ length: u }, () => new Set())
  const I = idx ? idx.getArray() : Array.from({ length: n }, (_, i) => i)
  for (let f = 0; f < I.length; f += 3) { const a = weld[I[f]], b = weld[I[f+1]], c = weld[I[f+2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b) }
  // boundary-ish vertices (few neighbours) are kept to preserve silhouettes
  const step = (lam) => { const T = new Float64Array(V); for (let v = 0; v < u; v++) { const s = nb[v]; if (s.size < 3) continue; let x = 0, y = 0, z = 0; for (const w of s) { x += T[3*w]; y += T[3*w+1]; z += T[3*w+2] } const k = s.size; V[3*v] += lam * (x/k - T[3*v]); V[3*v+1] += lam * (y/k - T[3*v+1]); V[3*v+2] += lam * (z/k - T[3*v+2]) } }
  for (let it = 0; it < N; it++) { step(0.5); step(-0.53) }
  const out = new Float32Array(n * 3); for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[3*i+c] = V[3*weld[i]+c]
  pos.setArray(out)
}
if (N) await doc.transform(normals({ overwrite: true }))
for (const m of doc.getRoot().listMaterials()) {
  if (!isNaN(R)) m.setRoughnessFactor(R)
  if (!isNaN(M)) m.setMetallicFactor(M)
  m.setMetallicRoughnessTexture(null)
  if (!isNaN(E) && m.getBaseColorTexture() && m.getAlphaMode() === 'OPAQUE') { m.setEmissiveTexture(m.getBaseColorTexture()); m.setEmissiveFactor([E, E, E]) }
}
await io.write(output, doc)
console.log('ok', output, N ? `smooth ${N}` : '')
