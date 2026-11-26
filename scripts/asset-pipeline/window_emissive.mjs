import { NodeIO } from '@gltf-transform/core'
const io = new NodeIO(); const f = process.argv[2]; const doc = await io.read(f)
for (const m of doc.getRoot().listMaterials()) m.setEmissiveFactor([0.5, 0.5, 0.5])
await io.write(f, doc); console.log('window emissive 0.5')
