// Aggressive, UV-aware simplification for AI-generated meshes with fragmented UV atlases.
// Uses meshoptimizer's Permissive mode so collapses may cross texture seams (UV-weighted).
// usage: node simplify.mjs in.glb out.glb targetTriangles [maxError=0.05] [uvWeight=0.5] [above:Y|below:Y]
import { NodeIO } from '@gltf-transform/core'
import { compactPrimitive, prune, dedup } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

const [, , input, output, targetStr, errStr = '0.05', uvwStr = '0.5', filter = ''] = process.argv
await MeshoptSimplifier.ready
const io = new NodeIO()
const doc = await io.read(input)
const target = Number(targetStr)

for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const uv = prim.getAttribute('TEXCOORD_0')
    const idx = prim.getIndices()
    let indices = new Uint32Array(idx.getArray())
    const positions = new Float32Array(pos.getArray())
    if (filter) {
      // Keep only faces whose centroid is above/below a height (used to split the helm off the body).
      const [mode, yStr] = filter.split(':')
      const yCut = Number(yStr)
      const kept = []
      for (let f = 0; f < indices.length; f += 3) {
        const cy = (positions[indices[f] * 3 + 1] + positions[indices[f + 1] * 3 + 1] + positions[indices[f + 2] * 3 + 1]) / 3
        if ((mode === 'above') === cy > yCut) kept.push(indices[f], indices[f + 1], indices[f + 2])
      }
      indices = new Uint32Array(kept)
      console.log(`filter ${filter}: kept ${kept.length / 3} faces`)
    }
    const before = indices.length / 3
    let result, error
    if (uv) {
      const uvs = new Float32Array(uv.getArray())
      ;[result, error] = MeshoptSimplifier.simplifyWithAttributes(
        indices, positions, 3, uvs, 2, [Number(uvwStr), Number(uvwStr)], null,
        Math.min(indices.length, target * 3), Number(errStr), ['Permissive', 'Prune']
      )
    } else {
      ;[result, error] = MeshoptSimplifier.simplify(indices, positions, 3, Math.min(indices.length, target * 3), Number(errStr), ['Permissive', 'Prune'])
    }
    idx.setArray(new Uint32Array(result))
    compactPrimitive(prim)
    console.log(`${mesh.getName() || 'mesh'}: ${before} -> ${result.length / 3} triangles (relative error ${error.toFixed(4)})`)
  }
}
await doc.transform(prune(), dedup())
await io.write(output, doc)
