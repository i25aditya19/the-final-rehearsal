// node teximg.mjs get in.glb texIndex out.jpg   |  node teximg.mjs set in.glb texIndex img.jpg out.glb
import { NodeIO } from '@gltf-transform/core'
import fs from 'fs'
const [cmd, input, ti, a, b] = process.argv.slice(2)
const io = new NodeIO(); const doc = await io.read(input)
const tex = doc.getRoot().listTextures()[Number(ti)]
if (cmd === 'get') fs.writeFileSync(a, tex.getImage())
else { tex.setImage(fs.readFileSync(a)); tex.setMimeType('image/jpeg'); await io.write(b, doc) }
console.log('ok', cmd, tex.getName() || ti)
