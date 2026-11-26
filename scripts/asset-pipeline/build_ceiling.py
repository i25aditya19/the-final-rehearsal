"""Readable celestial clock for the vault (original, procedural). Replaces the tangled generated
clock seen from below with clean, iconic forms that read at 20 m:

  assets/environment/celestial_dial.glb  face-down engraved dial, radius 1 (scaled in code):
                                          charcoal stone, silver rings, ivory Roman numerals,
                                          minute ticks, zodiac-band glyphs, a star field;
                                          engravings are faintly self-lit so they read without lights
  assets/environment/clock_hand.glb       tapered ivory blade, length 1 along +Z (hour/minute hands)
  assets/environment/armillary_ring.glb   clean antique-silver ring, radius 1, with tick studs
usage: python build_ceiling.py <repoDir>
"""
import sys, os, math
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont

repo = sys.argv[1]
ENV = f'{repo}/assets/environment'
S = 2048
C = S / 2
OBSIDIAN = (24, 24, 27)
CHARCOAL = (46, 46, 50)
SILVER = (182, 184, 190)
IVORY = (238, 235, 226)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'


def pol(r, a):
    """Dial-plane point (fraction of radius, angle from 12 o'clock, clockwise as seen from below)."""
    return C + math.sin(a) * r * C, C - math.cos(a) * r * C


def dial_textures():
    base = Image.new('RGB', (S, S), OBSIDIAN)
    em = Image.new('RGB', (S, S), (0, 0, 0))
    db, de = ImageDraw.Draw(base), ImageDraw.Draw(em)
    rng = np.random.default_rng(7)

    def ring(r, w, col, glow):
        bb = [C - r * C, C - r * C, C + r * C, C + r * C]
        db.ellipse(bb, outline=col, width=w)
        if glow:
            de.ellipse(bb, outline=tuple(int(c * glow) for c in col), width=w)

    # Charcoal stone bands with a darker centre field.
    db.ellipse([C - 0.98 * C] * 2 + [C + 0.98 * C] * 2, fill=CHARCOAL)
    db.ellipse([C - 0.62 * C] * 2 + [C + 0.62 * C] * 2, fill=OBSIDIAN)
    # Star field in the centre (tiny ivory points, faintly lit).
    for _ in range(260):
        r, a = 0.6 * math.sqrt(rng.random()), rng.random() * 2 * math.pi
        x, y = pol(r, a)
        s = rng.choice([1, 1, 2, 3])
        db.ellipse([x - s, y - s, x + s, y + s], fill=IVORY)
        de.ellipse([x - s, y - s, x + s, y + s], fill=(110, 110, 105))
    # Rings.
    for r, w, col, g in [(0.985, 10, SILVER, 0.35), (0.90, 4, SILVER, 0.3), (0.76, 4, SILVER, 0.3),
                         (0.70, 3, SILVER, 0.25), (0.62, 8, SILVER, 0.35), (0.30, 3, SILVER, 0.25), (0.14, 6, SILVER, 0.35)]:
        ring(r, w, col, g)
    # Minute ticks between 0.90 and 0.985; hour ticks longer.
    for i in range(60):
        a = i / 60 * 2 * math.pi
        r0 = 0.925 if i % 5 else 0.905
        x0, y0 = pol(r0, a)
        x1, y1 = pol(0.975, a)
        w = 3 if i % 5 else 8
        db.line([x0, y0, x1, y1], fill=IVORY, width=w)
        de.line([x0, y0, x1, y1], fill=(150, 148, 140), width=w)
    # Roman numerals, upright towards the centre, between 0.76 and 0.90.
    font = ImageFont.truetype(FONT, 118)
    numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    for i, n in enumerate(numerals):
        a = i / 12 * 2 * math.pi
        tile = Image.new('L', (360, 160), 0)
        ImageDraw.Draw(tile).text((180, 80), n, font=font, fill=255, anchor='mm')
        tile = tile.rotate(-math.degrees(a), resample=Image.BICUBIC, expand=True)
        x, y = pol(0.83, a)
        pos = (int(x - tile.width / 2), int(y - tile.height / 2))
        base.paste(Image.new('RGB', tile.size, IVORY), pos, tile)
        em.paste(Image.new('RGB', tile.size, (175, 172, 165)), pos, tile)
    # Zodiac band (0.62-0.70): twelve simple original glyphs (circles, crescents, stars).
    for i in range(12):
        a = (i + 0.5) / 12 * 2 * math.pi
        x, y = pol(0.66, a)
        k = 26
        kind = i % 4
        if kind == 0:
            db.ellipse([x - k, y - k, x + k, y + k], outline=SILVER, width=5)
            db.ellipse([x - 6, y - 6, x + 6, y + 6], fill=SILVER)
        elif kind == 1:
            db.ellipse([x - k, y - k, x + k, y + k], fill=SILVER)
            db.ellipse([x - k + 12, y - k - 4, x + k + 12, y + k - 4], fill=CHARCOAL)
        elif kind == 2:
            pts = [pol(0.66 + 0.022 * math.cos(t * math.pi * 4 / 5) * (1 if t % 2 == 0 else 0.45), a + 0.035 * math.sin(t * math.pi * 4 / 5) * (1 if t % 2 == 0 else 0.45)) for t in range(10)]
            db.polygon(pts, fill=SILVER)
        else:
            db.line([x - k, y, x + k, y], fill=SILVER, width=5)
            db.line([x, y - k, x, y + k], fill=SILVER, width=5)
            db.ellipse([x - 10, y - 10, x + 10, y + 10], outline=SILVER, width=4)
        # dividers
        x0, y0 = pol(0.625, i / 12 * 2 * math.pi)
        x1, y1 = pol(0.695, i / 12 * 2 * math.pi)
        db.line([x0, y0, x1, y1], fill=SILVER, width=4)
    # Eight-point compass rose in the centre field.
    for i in range(8):
        a = i / 8 * 2 * math.pi
        L = 0.28 if i % 2 == 0 else 0.18
        tip = pol(L, a)
        l, r = pol(0.04, a - 0.5), pol(0.04, a + 0.5)
        db.polygon([tip, l, (C, C), r], fill=SILVER if i % 2 == 0 else (120, 122, 128))
        de.polygon([tip, l, (C, C), r], fill=(60, 60, 62))
    return base, em


def pbr(base, em, rough=0.9, ef=1.0, alpha='OPAQUE'):
    return trimesh.visual.material.PBRMaterial(baseColorTexture=base, emissiveTexture=em, emissiveFactor=[ef] * 3,
                                               metallicFactor=0.0, roughnessFactor=rough, alphaMode=alpha, doubleSided=False)


def dial_mesh(seg=128):
    """Disc in XZ facing down (-Y), plus a short rim band. UVs keep the numerals unmirrored from below."""
    verts, uv, faces = [[0, 0, 0]], [[0.5, 0.5]], []
    for i in range(seg):
        a = i / seg * 2 * math.pi
        x, z = math.sin(a), math.cos(a)
        verts.append([x, 0, z])
        # seen from below, screen-right is -X and screen-up is +Z
        uv.append([0.5 - x / 2, 0.5 - z / 2])
    for i in range(seg):
        a, b = 1 + i, 1 + (i + 1) % seg
        faces.append([0, a, b])  # wound to face -Y
    m = trimesh.Trimesh(np.array(verts), np.array(faces), process=False)
    if m.face_normals[0][1] > 0:
        m.invert()
    m.visual = trimesh.visual.TextureVisuals(uv=np.array(uv))
    # rim band (outer edge, 0.06 tall), sampled from the dial's silver outer ring
    rv, ruv, rf = [], [], []
    for i in range(seg + 1):
        a = i / seg * 2 * math.pi
        x, z = math.sin(a), math.cos(a)
        rv += [[x, 0.0, z], [x, 0.06, z]]
        ruv += [[0.5 - 0.99 * x / 2, 0.5 - 0.99 * z / 2]] * 2
    for i in range(seg):
        p = 2 * i
        rf += [[p, p + 1, p + 2], [p + 1, p + 3, p + 2]]
    rim = trimesh.Trimesh(np.array(rv), np.array(rf), process=False)
    if np.mean(rim.face_normals[:, 0] * rim.triangles_center[:, 0] + rim.face_normals[:, 2] * rim.triangles_center[:, 2]) < 0:
        rim.invert()
    rim.visual = trimesh.visual.TextureVisuals(uv=np.array(ruv))
    return m, rim


def export(path, parts):
    s = trimesh.Scene()
    for name, mesh in parts:
        s.add_geometry(mesh, node_name=name, geom_name=name)
    s.export(path)
    print(os.path.basename(path), sum(len(m.faces) for _, m in parts), 'tris')


base, em = dial_textures()
disc, rim = dial_mesh()
mat = pbr(base, em, 0.88, 1.0)
disc.visual.material = mat
rim.visual.material = mat
export(f'{ENV}/celestial_dial.glb', [('dial', disc), ('rim', rim)])

# Clock hand: a tapered blade with a lozenge counterweight, ivory, lightly self-lit.
levels = [(-0.18, 0.0), (-0.08, 0.05), (0.0, 0.035), (0.62, 0.022), (0.72, 0.06), (1.0, 0.0)]  # (z, half-width)
hv, hf = [], []
for y in (0.0, -0.025):  # two faces, a thin plate
    o = len(hv)
    for z, w in levels:
        hv += [[-w, y, z], [w, y, z]]
    for i in range(len(levels) - 1):
        p0 = o + 2 * i
        q = [[p0, p0 + 2, p0 + 1], [p0 + 1, p0 + 2, p0 + 3]]
        hf += q if y < 0 else [f[::-1] for f in q]
tri = trimesh.Trimesh(np.array(hv), np.array(hf), process=False)
tri.visual = trimesh.visual.TextureVisuals(uv=np.zeros((len(tri.vertices), 2)) + 0.5)
tri.visual.material = pbr(Image.new('RGB', (4, 4), IVORY), Image.new('RGB', (4, 4), (120, 118, 110)), 0.7)
export(f'{ENV}/clock_hand.glb', [('hand', tri)])

# Armillary ring: a clean torus with small studs every 30 degrees.
ring = trimesh.creation.torus(major_radius=1.0, minor_radius=0.018, major_sections=96, minor_sections=8)
studs = []
for i in range(12):
    a = i / 12 * 2 * math.pi
    st = trimesh.creation.icosphere(subdivisions=1, radius=0.04)
    st.apply_translation([math.sin(a), math.cos(a), 0])  # torus lies in XY before the rotation below
    studs.append(st)
rm = trimesh.util.concatenate([ring] + studs)
# torus is built around Z: lay it flat in XZ
rm.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
rm.visual = trimesh.visual.TextureVisuals(uv=np.zeros((len(rm.vertices), 2)) + 0.5)
rm.visual.material = pbr(Image.new('RGB', (4, 4), SILVER), Image.new('RGB', (4, 4), (52, 52, 56)), 0.75)
export(f'{ENV}/armillary_ring.glb', [('ring', rm)])
base.resize((512, 512)).save('/tmp/dial_preview.png')
