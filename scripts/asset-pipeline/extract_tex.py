import sys, io, pygltflib
from PIL import Image
src, prefix = sys.argv[1], sys.argv[2]
g = pygltflib.GLTF2().load(src)
blob = g.binary_blob()
for i, img in enumerate(g.images):
    bv = g.bufferViews[img.bufferView]
    data = blob[bv.byteOffset or 0:(bv.byteOffset or 0) + bv.byteLength]
    im = Image.open(io.BytesIO(data))
    im.save(f"{prefix}_img{i}.png")
    small = im.convert('RGB').resize((512, 512))
    small.save(f"{prefix}_img{i}_small.png")
    import numpy as np
    a = np.asarray(im.convert('RGB')).reshape(-1, 3).astype(float)
    print(prefix, i, im.size, im.mode, 'mean RGB', a.mean(0).round(1))
m = g.materials[0]
print(prefix, 'material', m.pbrMetallicRoughness.baseColorFactor, m.pbrMetallicRoughness.metallicFactor, m.pbrMetallicRoughness.roughnessFactor, m.emissiveFactor)
