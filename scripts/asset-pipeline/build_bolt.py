"""The Watcher's bolt ('ember of the archive'): a crimson comet that matches the game's beams and
spells. One GLB, flying along +Z (the scene orients it to its velocity):
  core  white-hot heart (opaque, self-lit)
  glow  crimson halo (translucent)
  tail  tapering crimson streak behind it, fading to nothing (translucent gradient)
  ring  a thin rune ring around the flight axis (the scene rolls the bolt, so it spins)
usage: python build_bolt.py <repoDir>"""
import sys, math
import numpy as np
import trimesh
from PIL import Image

repo = sys.argv[1]
OUT = f'{repo}/assets/fx/hex_bolt.glb'


def mat(rgba_img, emissive_rgb, strength, blend):
    return trimesh.visual.material.PBRMaterial(
        baseColorTexture=rgba_img, emissiveTexture=emissive_rgb, emissiveFactor=[strength] * 3,
        metallicFactor=0.0, roughnessFactor=1.0, alphaMode='BLEND' if blend else 'OPAQUE', doubleSided=blend)


def flat(rgb, a=255):
    img = Image.new('RGBA', (4, 4), (*rgb, a))
    return img, img.convert('RGB')


def tex_mesh(m, uv, material):
    m.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    return m


# core: white-hot with a crimson blush
core = trimesh.creation.icosphere(subdivisions=1, radius=0.2)
im, em = flat((255, 226, 232))
core = tex_mesh(core, np.full((len(core.vertices), 2), 0.5), mat(im, em, 1.0, False))

# glow: crimson halo
glow = trimesh.creation.icosphere(subdivisions=2, radius=0.46)
im, em = flat((230, 40, 75), 105)
glow = tex_mesh(glow, np.full((len(glow.vertices), 2), 0.5), mat(im, em, 1.0, True))

# tail: a cone from the head (z=0, r=0.3) back to a point (z=-2.4), alpha fading along it
segs, rows, L = 12, 6, 2.4
verts, uv, faces = [], [], []
for j in range(rows + 1):
    v = j / rows
    r = 0.3 * (1 - v) ** 1.3 + 0.005
    for i in range(segs + 1):
        a = 2 * math.pi * i / segs
        verts.append([math.cos(a) * r, math.sin(a) * r, -L * v])
        uv.append([i / segs, 1 - v])
w = segs + 1
for j in range(rows):
    for i in range(segs):
        p, q = j * w + i, (j + 1) * w + i
        faces += [[p, q, p + 1], [p + 1, q, q + 1]]
H = 64
vv = np.linspace(0, 1, H)[:, None] * np.ones((1, 8))
alpha = (np.clip(vv, 0, 1) ** 1.6 * 230).astype(np.uint8)  # image row 0 = v 1 (head) after flip below
rgb = np.zeros((H, 8, 3), np.uint8)
rgb[..., 0], rgb[..., 1], rgb[..., 2] = 240, 60, 95
img = Image.fromarray(np.dstack([rgb, alpha])[::-1].copy(), 'RGBA')
tail = trimesh.Trimesh(np.array(verts), np.array(faces), process=False)
tail = tex_mesh(tail, np.array(uv), mat(img, img.convert('RGB'), 1.0, True))

# rune ring around the flight axis
ring = trimesh.creation.torus(major_radius=0.42, minor_radius=0.025, major_sections=32, minor_sections=4)
# notches: four small studs on the ring
studs = [trimesh.creation.icosphere(subdivisions=0, radius=0.06) for _ in range(4)]
for k, st in enumerate(studs):
    a = k * math.pi / 2
    st.apply_translation([math.cos(a) * 0.42, math.sin(a) * 0.42, 0])
ring = trimesh.util.concatenate([ring] + studs)
im, em = flat((255, 90, 120))
ring = tex_mesh(ring, np.full((len(ring.vertices), 2), 0.5), mat(im, em, 1.0, False))

s = trimesh.Scene()
for name, m in [('core', core), ('ring', ring), ('glow', glow), ('tail', tail)]:
    s.add_geometry(m, node_name=name, geom_name=name)
s.export(OUT)
print('hex_bolt', sum(len(m.faces) for m in [core, ring, glow, tail]), 'tris')
