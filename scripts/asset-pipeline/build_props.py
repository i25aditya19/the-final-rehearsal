"""Small shared props (original, procedural):
  assets/fx/orb_<colour>.glb      low-poly glowing orbs (80 triangles) replacing built-in spheres
                                   (spell cores, volley bolts, candle flames, twinkles)
  assets/fx/glow_<colour>.glb     soft translucent halo orbs
  assets/fx/shard.glb             porcelain fragment for the mask shatter
  assets/environment/book.glb     closed antique book (charcoal leather, silver clasp, ivory pages)
usage: python build_props.py <repoDir>
"""
import sys, os, io
import numpy as np
import trimesh
from PIL import Image, ImageDraw

repo = sys.argv[1]
FX = f'{repo}/assets/fx'
ENV = f'{repo}/assets/environment'
os.makedirs(FX, exist_ok=True)

COLOURS = {
    'white': (255, 255, 255), 'cyan': (133, 223, 255), 'crimson': (255, 74, 100), 'gold': (216, 183, 107),
    'flame': (255, 232, 200), 'ivory': (241, 239, 234)
}


def solid(rgb, a=255, size=4):
    return Image.new('RGBA' if a < 255 else 'RGB', (size, size), (*rgb, a) if a < 255 else rgb)


def export(path, mesh):
    s = trimesh.Scene()
    s.add_geometry(mesh, node_name='mesh', geom_name='mesh')
    s.export(path)


def orb(subdiv=1):
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=0.5)
    m.visual = trimesh.visual.TextureVisuals(uv=np.zeros((len(m.vertices), 2)) + 0.5)
    return m


for name, rgb in COLOURS.items():
    m = orb(1)
    m.visual.material = trimesh.visual.material.PBRMaterial(
        baseColorTexture=solid(rgb), emissiveTexture=solid(rgb), emissiveFactor=[1, 1, 1], metallicFactor=0, roughnessFactor=1)
    export(f'{FX}/orb_{name}.glb', m)
    g = orb(1)
    g.visual.material = trimesh.visual.material.PBRMaterial(
        baseColorTexture=solid(rgb, 70), emissiveTexture=solid(rgb), emissiveFactor=[0.8, 0.8, 0.8],
        alphaMode='BLEND', doubleSided=True, metallicFactor=0, roughnessFactor=1)
    export(f'{FX}/glow_{name}.glb', g)

# Porcelain shard: a flattened, irregular tetrahedral sliver.
v = np.array([[0, 0, 0.5], [0.22, 0.02, -0.3], [-0.25, -0.02, -0.25], [0.03, 0.08, 0.0]])
f = np.array([[0, 1, 3], [1, 2, 3], [2, 0, 3], [0, 2, 1]])
sh = trimesh.Trimesh(v, f)
sh.visual = trimesh.visual.TextureVisuals(uv=np.zeros((4, 2)) + 0.5, material=trimesh.visual.material.PBRMaterial(
    baseColorTexture=solid((236, 232, 222)), emissiveTexture=solid((60, 55, 45)), emissiveFactor=[1, 1, 1], roughnessFactor=0.4, doubleSided=True))
export(f'{FX}/shard.glb', sh)

# Book: cover box with a texture atlas (leather cover, ivory page edge, silver clasp).
tex = Image.new('RGB', (256, 256), (38, 37, 40))
d = ImageDraw.Draw(tex)
d.rectangle([128, 0, 255, 127], fill=(214, 208, 192))                 # page edges
for y in range(4, 128, 6):
    d.line([(130, y), (253, y)], fill=(188, 182, 166))
d.rectangle([10, 10, 117, 117], outline=(170, 172, 178), width=3)    # silver frame on cover
d.ellipse([44, 44, 84, 84], outline=(170, 172, 178), width=3)        # celestial roundel
d.rectangle([0, 128, 127, 255], fill=(28, 27, 30))                    # spine
b = io.BytesIO(); tex.save(b, 'JPEG', quality=88); b.seek(0); tex = Image.open(b)
book = trimesh.creation.box(extents=[0.32, 0.07, 0.24])
uv = np.zeros((len(book.vertices), 2))
for i, p in enumerate(book.vertices):
    if abs(p[1]) > 0.03:      # covers
        uv[i] = [0.25 + p[0] * 1.4, 0.75 + p[2] * 1.6]
    else:                      # page edges
        uv[i] = [0.75 + p[0] * 1.2, 0.75 + p[2] * 1.4]
book.visual = trimesh.visual.TextureVisuals(uv=uv, material=trimesh.visual.material.PBRMaterial(baseColorTexture=tex, roughnessFactor=0.8))
clasp = trimesh.creation.box(extents=[0.05, 0.075, 0.03])
clasp.apply_translation([0.16, 0, 0])
clasp.visual = trimesh.visual.TextureVisuals(uv=np.zeros((len(clasp.vertices), 2)) + 0.5, material=trimesh.visual.material.PBRMaterial(baseColorTexture=solid((176, 178, 184)), roughnessFactor=0.5))
s = trimesh.Scene()
s.add_geometry(book, node_name='book', geom_name='book')
s.add_geometry(clasp, node_name='clasp', geom_name='clasp')
s.export(f'{ENV}/book.glb')
print('props written')
