// Replace textures/material of a simplified GLB: baseColor JPEG, optional emissive JPEG,
// drop the metallic-roughness map in favour of constant factors, quantize-free cleanup.
// usage: node finalize.mjs in.glb out.glb base.jpg metallic roughness [emissive.jpg emissiveStrength]
import { readFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { prune, dedup } from '@gltf-transform/functions'

const [, , input, output, baseJpg, metallic, roughness, emissiveJpg, emissiveStrength = '1'] = process.argv
const io = new NodeIO()
const doc = await io.read(input)
const root = doc.getRoot()

for (const mat of root.listMaterials()) {
  const baseTex = doc.createTexture('baseColor').setImage(readFileSync(baseJpg)).setMimeType('image/jpeg')
  mat.setBaseColorTexture(baseTex)
  mat.setBaseColorFactor([1, 1, 1, 1])
  mat.setMetallicRoughnessTexture(null)
  mat.setMetallicFactor(Number(metallic))
  mat.setRoughnessFactor(Number(roughness))
  mat.setAlphaMode('OPAQUE')
  mat.setDoubleSided(true)
  if (emissiveJpg) {
    const em = doc.createTexture('emissive').setImage(readFileSync(emissiveJpg)).setMimeType('image/jpeg')
    mat.setEmissiveTexture(em)
    mat.setEmissiveFactor([1, 1, 1])
    // KHR_materials_emissive_strength is not assumed; factor 1 keeps it standard glTF.
  }
}
// Name the mesh/node for readable debugging in the client.
const label = output.split('/').pop().replace('.glb', '')
for (const n of root.listNodes()) n.setName(label)
for (const m of root.listMeshes()) m.setName(label)
await doc.transform(prune(), dedup())
await io.write(output, doc)
console.log('wrote', output)
