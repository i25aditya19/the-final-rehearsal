"""Smooth telegraph meshes (original, procedural) replacing box-built floor warnings.
Unit-sized so code scales them: radius 1 in XZ. Soft gradient textures with alpha, emissive.

assets/telegraphs/
  wedge34_{soft,hot}.glb        Gaze cone (34 deg), inner radius 0.19
  wedge88_{crimson,ivory,gold}.glb  Blind Spot quadrants (88 deg), inner radius 0.235
  wave_band.glb                 Aftershock: two 130-deg glowing ribbons with gaps at 0/180 deg
                                (unit radius, 1 m tall), plus a floor glow strip
  disc_{crimson,ivory}.glb      Final Observation danger floor / safe circles (soft rim)
usage: python build_telegraphs.py <repoDir>
"""
import sys, math, os
import numpy as np
import trimesh
from PIL import Image

repo = sys.argv[1]
OUT = f'{repo}/assets/telegraphs'
os.makedirs(OUT, exist_ok=True)
COL = {'crimson': (197, 34, 63), 'ivory': (241, 239, 234), 'gold': (216, 183, 107), 'hot': (255, 96, 120)}


def gradient_tex(color, kind, size=256):
    """RGBA texture. u runs across the shape (0..1), v runs radially outward (0..1)."""
    u = np.linspace(0, 1, size)[None, :]
    v = np.linspace(0, 1, size)[:, None]
    if kind == 'wedge':
        edge = np.maximum(np.exp(-(u / 0.035) ** 2), np.exp(-((1 - u) / 0.035) ** 2))  # bright side edges
        far = np.exp(-((1 - v) / 0.03) ** 2)                                           # bright far rim
        body = 0.32 + 0.18 * v                                                         # stronger outward
        stripes = 0.07 * (np.sin(v * 70) > 0.75)                                      # faint ripples
        a = np.clip(body + stripes + 0.75 * edge + 0.7 * far, 0, 1)
    elif kind == 'band':
        a = np.clip(np.exp(-((v - 0.0) / 0.55) ** 2) * 0.95 + 0.1, 0, 1) * np.ones_like(u)   # bright at bottom, fading up
    elif kind == 'strip':
        a = np.exp(-((v - 0.5) / 0.28) ** 2) * np.ones_like(u)
    else:  # disc: v = radius
        a = np.clip(0.28 + 0.9 * np.exp(-((1 - v) / 0.06) ** 2) + 0.06 * (np.sin(v * 50) > 0.8), 0, 1) * np.ones_like(u)
    rgb = np.ones((size, size, 3)) * np.array(color)[None, None, :]
    img = np.dstack([rgb, a * 255]).astype(np.uint8)
    return Image.fromarray(img, 'RGBA')


def material(color, kind, strength=1.2):
    tex = gradient_tex(color, kind)
    return trimesh.visual.material.PBRMaterial(
        baseColorTexture=tex, emissiveTexture=tex.convert("RGB"), emissiveFactor=[min(1.0, strength)] * 3,
        alphaMode='BLEND', doubleSided=True, metallicFactor=0.0, roughnessFactor=1.0)


def sector(deg, inner, segs=40, rings=8):
    verts, uv, faces = [], [], []
    for j in range(rings + 1):
        r = inner + (1 - inner) * j / rings
        for i in range(segs + 1):
            a = math.radians(-deg / 2 + deg * i / segs)
            verts.append([math.sin(a) * r, 0, math.cos(a) * r])
            uv.append([i / segs, 1 - j / rings])
    w = segs + 1
    for j in range(rings):
        for i in range(segs):
            a, b, c, d = j * w + i, j * w + i + 1, (j + 1) * w + i, (j + 1) * w + i + 1
            faces += [[a, b, c], [b, d, c]]
    return np.array(verts), np.array(faces), np.array(uv)


def ribbon(a0, a1, segs=60, height=1.0):
    verts, uv, faces = [], [], []
    for i in range(segs + 1):
        a = math.radians(a0 + (a1 - a0) * i / segs)
        for k, y in enumerate((0.0, height)):
            verts.append([math.sin(a) * 1.0, y, math.cos(a) * 1.0])
            uv.append([i / segs, 1 - k])
    for i in range(segs):
        p = i * 2
        faces += [[p, p + 2, p + 1], [p + 1, p + 2, p + 3]]
    return np.array(verts), np.array(faces), np.array(uv)


def strip(a0, a1, width=0.06, segs=60):
    verts, uv, faces = [], [], []
    for i in range(segs + 1):
        a = math.radians(a0 + (a1 - a0) * i / segs)
        for k, r in enumerate((1 - width, 1 + width)):
            verts.append([math.sin(a) * r, 0.0, math.cos(a) * r])
            uv.append([i / segs, 1 - k])
    for i in range(segs):
        p = i * 2
        faces += [[p, p + 2, p + 1], [p + 1, p + 2, p + 3]]
    return np.array(verts), np.array(faces), np.array(uv)


def disc(segs=72, rings=10):
    verts, uv, faces = [[0, 0, 0]], [[0.5, 1.0]], []
    for j in range(1, rings + 1):
        r = j / rings
        for i in range(segs):
            a = 2 * math.pi * i / segs
            verts.append([math.sin(a) * r, 0, math.cos(a) * r])
            uv.append([i / segs, 1 - r])
    for i in range(segs):
        faces.append([0, 1 + i, 1 + (i + 1) % segs])
    for j in range(rings - 1):
        b0, b1 = 1 + j * segs, 1 + (j + 1) * segs
        for i in range(segs):
            a, b, c, d = b0 + i, b0 + (i + 1) % segs, b1 + i, b1 + (i + 1) % segs
            faces += [[a, c, b], [b, c, d]]
    return np.array(verts, float), np.array(faces), np.array(uv, float)


def mesh(v, f, uv, mat):
    m = trimesh.Trimesh(vertices=v, faces=f, process=False)
    m.visual = trimesh.visual.TextureVisuals(uv=uv, material=mat)
    return m


def export(name, parts):
    s = trimesh.Scene()
    for node, m in parts:
        s.add_geometry(m, node_name=node, geom_name=node)
    s.export(f'{OUT}/{name}.glb')
    print(name, sum(len(m.faces) for _, m in parts), 'tris')


export('wedge34_soft', [('wedge', mesh(*sector(34, 0.19), material(COL['crimson'], 'wedge', 0.9)))])
export('wedge34_hot', [('wedge', mesh(*sector(34, 0.19), material(COL['hot'], 'wedge', 2.2)))])
for c in ('crimson', 'ivory', 'gold'):
    export(f'wedge88_{c}', [('wedge', mesh(*sector(88, 0.235, 48, 8), material(COL[c], 'wedge', 1.0 if c != 'crimson' else 1.1)))])
band_parts = []
for i, (a0, a1) in enumerate(((25, 155), (205, 335))):
    band_parts.append((f'band{i}', mesh(*ribbon(a0, a1), material(COL['hot'], 'band', 2.0))))
    band_parts.append((f'strip{i}', mesh(*strip(a0, a1), material(COL['crimson'], 'strip', 1.6))))
export('wave_band', band_parts)
export('disc_crimson', [('disc', mesh(*disc(), material(COL['crimson'], 'disc', 0.9)))])
export('disc_ivory', [('disc', mesh(*disc(), material(COL['ivory'], 'disc', 1.4)))])
