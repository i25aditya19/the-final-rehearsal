"""Procedural chamber shell for THE FINAL REHEARSAL (original geometry and textures).

Writes into assets/environment/:
  chamber_floor.glb  - astronomical ritual marble disc (r = 23.4 m), gameplay rings baked in
  chamber_wall.glb   - continuous ashlar wall (inner face) from the floor to the vault springing
  chamber_vault.glb  - pointed ribbed dome with a silver star map, ribs above each pillar,
                       springing ring, gallery ledge joining pillar tops to the wall, pilasters
All dimensions come from the arena constants below (keep in sync with src/config.ts ARENA).
usage: python build_chamber_shell.py <repoDir>
"""
import sys, math
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter

repo = sys.argv[1]
OUT = f'{repo}/assets/environment'

R_PLAY = 20.0          # playable radius
R_WALLLOW = 23.0       # low combat wall
R_RING = 24.8          # pillar/arch ring
R_WALL = 28.2          # chamber wall
H_GALLERY = 13.5       # gallery ledge (pillar/arch tops)
H_SPRING = 19.0        # vault springing line
H_APEX = 35.0          # vault apex
DAIS = 4.5
PILLAR_DEG = [i * 30 + 15 for i in range(12)]

rng = np.random.default_rng(7)


# ------------------------------------------------------------------ textures
def fbm(n, octaves=6, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((n, n), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        k = 2 ** (o + 2)
        g = r.random((k + 1, k + 1)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
        out += amp * np.asarray(img, np.float32) / 255
        total += amp
        amp *= 0.5
    return out / total


def marble_floor(size=2048):
    """Mid-grey marble with veins, dark inlaid rings, silver lines, zodiac ring and star."""
    n = fbm(size, 7, 1)
    x = np.linspace(-1, 1, size)
    X, Y = np.meshgrid(x, x)
    veins = np.abs(np.sin((X * 3.1 + Y * 1.7 + n * 5.5) * math.pi))
    veins = 1 - np.clip(veins * 6, 0, 1)
    base = 0.40 + 0.10 * n + 0.16 * veins          # ~0.40-0.66 mid marble
    # Darker polished border band outside the playable edge.
    rad = np.sqrt(X ** 2 + Y ** 2) * 23.4
    base = np.where(rad > R_PLAY + 0.15, 0.17 + 0.05 * n + 0.06 * veins, base)
    rgb = np.stack([base * 1.0, base * 0.99, base * 0.965], -1)
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    c = size / 2
    s = size / 2 / 23.4  # px per metre
    def circle(r, w, col):
        d.ellipse([c - r * s, c - r * s, c + r * s, c + r * s], outline=col, width=max(1, int(w * s)))
    dark = (44, 44, 46)
    silver = (196, 197, 200)
    ivory = (226, 222, 212)
    circle(R_PLAY, 0.14, silver)
    circle(R_PLAY - 0.35, 0.05, silver)
    # Zodiac ring between 15.6 and 17.4 m with 12 houses and glyph circles.
    circle(17.4, 0.08, silver)
    circle(15.6, 0.08, silver)
    for i in range(12):
        a = math.radians(i * 30)
        d.line([c + math.sin(a) * 15.6 * s, c - math.cos(a) * 15.6 * s, c + math.sin(a) * 17.4 * s, c - math.cos(a) * 17.4 * s], fill=silver, width=int(0.06 * s))
        a2 = math.radians(i * 30 + 15)
        gx, gy = c + math.sin(a2) * 16.5 * s, c - math.cos(a2) * 16.5 * s
        rr = 0.45 * s
        d.ellipse([gx - rr, gy - rr, gx + rr, gy + rr], outline=ivory, width=int(0.05 * s))
        # a simple original glyph: a line + dot whose angle depends on the house
        b = math.radians(i * 47)
        d.line([gx - math.cos(b) * rr * 0.7, gy - math.sin(b) * rr * 0.7, gx + math.cos(b) * rr * 0.7, gy + math.sin(b) * rr * 0.7], fill=ivory, width=int(0.04 * s))
        d.ellipse([gx - 3, gy - 3, gx + 3, gy + 3], fill=ivory)
    # Gameplay rings (were stacked discs): 0.75 R and 0.5 R, dark inlay with silver edges.
    for r in (R_PLAY * 0.75, R_PLAY * 0.5):
        circle(r, 0.22, dark)
        circle(r + 0.13, 0.04, silver)
        circle(r - 0.13, 0.04, silver)
    # Eight-pointed star around the dais and the dais itself.
    pts = []
    for i in range(16):
        r = 9.2 if i % 2 == 0 else 6.2
        a = math.radians(i * 22.5)
        pts.append((c + math.sin(a) * r * s, c - math.cos(a) * r * s))
    d.polygon(pts, outline=silver, width=int(0.06 * s))
    d.ellipse([c - (DAIS + 0.15) * s, c - (DAIS + 0.15) * s, c + (DAIS + 0.15) * s, c + (DAIS + 0.15) * s], fill=silver)
    d.ellipse([c - DAIS * s, c - DAIS * s, c + DAIS * s, c + DAIS * s], fill=(36, 36, 38))
    circle(DAIS - 0.6, 0.04, (120, 120, 124))
    return img


def ashlar(size=1024, tone=0.34):
    """Charcoal ashlar blocks with darker mortar; tiles horizontally and vertically."""
    n = fbm(size, 6, 3)
    a = tone + 0.06 * (n - 0.5)
    img = np.stack([a, a, a * 1.01], -1)
    rows, cols = 6, 4
    bh, bw = size // rows, size // cols
    for r in range(rows):
        off = (bw // 2) * (r % 2)
        shade = rng.uniform(-0.035, 0.035, cols + 1)
        for k in range(cols + 1):
            x0 = (k * bw + off) % size
            x1 = x0 + bw
            for xs in [(x0, min(x1, size)), (0, max(0, x1 - size))]:
                if xs[1] > xs[0]:
                    img[r * bh:(r + 1) * bh, xs[0]:xs[1]] += shade[k]
        img[r * bh:r * bh + 5] *= 0.55
        for k in range(cols + 1):
            x = (k * bw + off) % size
            img[r * bh:(r + 1) * bh, max(0, x - 3):x + 3] *= 0.55
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


def starmap(size=2048):
    """Vault ceiling: deep charcoal with faint silver stars and constellation lines (original)."""
    n = fbm(size, 6, 5)
    base = 0.13 + 0.06 * n
    img = Image.fromarray((np.stack([base, base, base * 1.04], -1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    r2 = np.random.default_rng(11)
    stars = r2.random((900, 2)) * size
    for x, y in stars:
        b = r2.uniform(120, 235)
        rad = r2.choice([1, 1, 1, 2, 3])
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(int(b), int(b), int(b * 1.02)))
    # Small, compact constellations: a few nearby stars joined in sequence.
    for k in range(22):
        cx, cy = r2.uniform(0.1, 0.9, 2) * size
        pts = []
        for j in range(r2.integers(4, 7)):
            ang = r2.uniform(0, 2 * math.pi)
            dist = r2.uniform(30, 110)
            px = (pts[-1][0] if pts else cx) + math.cos(ang) * dist
            py = (pts[-1][1] if pts else cy) + math.sin(ang) * dist
            pts.append((px, py))
        d.line(pts, fill=(150, 152, 158), width=2)
        for px, py in pts:
            d.ellipse([px - 4, py - 4, px + 4, py + 4], fill=(225, 226, 232))
    c = size / 2
    for r in (size * 0.12, size * 0.30, size * 0.46):
        d.ellipse([c - r, c - r, c + r, c + r], outline=(170, 172, 178), width=4)
    return img


def solid(col, size=8):
    return Image.new('RGB', (size, size), col)


def mat(img, rough=0.85, metal=0.0, emissive=None, em_strength=1.0):
    kw = dict(baseColorTexture=img, metallicFactor=metal, roughnessFactor=rough, doubleSided=True)
    if emissive is not None:
        kw['emissiveTexture'] = emissive
        kw['emissiveFactor'] = [em_strength] * 3
    return trimesh.visual.material.PBRMaterial(**kw)


def textured(vertices, faces, uv, material):
    m = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    m.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    return m


# ------------------------------------------------------------------ geometry
def disc(radius, segs, y):
    verts = [[0, y, 0]]
    uv = [[0.5, 0.5]]
    for i in range(segs):
        a = 2 * math.pi * i / segs
        x, z = math.sin(a) * radius, math.cos(a) * radius
        verts.append([x, y, z])
        uv.append([0.5 + x / (2 * radius), 0.5 - z / (2 * radius)])
    faces = [[0, 1 + (i + 1) % segs, 1 + i] for i in range(segs)]  # facing up
    return np.array(verts), np.array(faces), np.array(uv)


def cylinder_inner(radius, y0, y1, segs, tile_w, tile_h, rows=1):
    verts, uv, faces = [], [], []
    circ = 2 * math.pi * radius
    for j in range(rows + 1):
        y = y0 + (y1 - y0) * j / rows
        for i in range(segs + 1):
            a = 2 * math.pi * i / segs
            verts.append([math.sin(a) * radius, y, math.cos(a) * radius])
            uv.append([circ * i / segs / tile_w, (y - y0) / tile_h])
    w = segs + 1
    for j in range(rows):
        for i in range(segs):
            a, b, c, d = j * w + i, j * w + i + 1, (j + 1) * w + i, (j + 1) * w + i + 1
            faces += [[a, c, b], [b, c, d]]  # facing inward
    return np.array(verts), np.array(faces), np.array(uv)


def vault_profile(t):
    """t in [0,1] from springing to apex -> (radius, height) of a pointed dome."""
    r = R_WALL * (1 - t)
    h = H_SPRING + (H_APEX - H_SPRING) * math.sin(t * math.pi / 2) ** 0.85
    return r, h


def vault(segs=72, rings=22):
    verts, uv, faces = [], [], []
    for j in range(rings + 1):
        r, h = vault_profile(j / rings)
        for i in range(segs + 1):
            a = 2 * math.pi * i / segs
            x, z = math.sin(a) * r, math.cos(a) * r
            verts.append([x, h, z])
            uv.append([0.5 + x / (2 * R_WALL), 0.5 - z / (2 * R_WALL)])  # star map projected from below
    w = segs + 1
    for j in range(rings):
        for i in range(segs):
            a, b, c, d = j * w + i, j * w + i + 1, (j + 1) * w + i, (j + 1) * w + i + 1
            faces += [[a, c, b], [b, c, d]]
    return np.array(verts), np.array(faces), np.array(uv)


def box_between(p0, p1, w, h):
    """Box mesh from p0 to p1 (centre line) with width w (horizontal) and height h."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    L = np.linalg.norm(d)
    b = trimesh.creation.box(extents=[w, h, L])
    z = d / L
    up = np.array([0, 1.0, 0])
    x = np.cross(up, z)
    if np.linalg.norm(x) < 1e-6:
        x = np.array([1.0, 0, 0])
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    M = np.eye(4)
    M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = x, y, z, (p0 + p1) / 2
    b.apply_transform(M)
    return b


def uv_box(meshes, material):
    m = trimesh.util.concatenate(meshes)
    uv = np.c_[m.vertices[:, 0] * 0.2 + m.vertices[:, 2] * 0.13, m.vertices[:, 1] * 0.2]
    m.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    return m


def export(name, parts):
    scene = trimesh.Scene()
    for node, mesh in parts:
        scene.add_geometry(mesh, node_name=node, geom_name=node)
    path = f'{OUT}/{name}.glb'
    scene.export(path)
    tris = sum(len(m.faces) for _, m in parts)
    print(f'{name}: {tris} triangles')


# floor
v, f, uv = disc(23.4, 128, 0.0)
export('chamber_floor', [('floor', textured(v, f, uv, mat(marble_floor(), rough=0.55)))])

# wall: lower and upper courses, ashlar texture (tiles every 4 m x 3 m)
wall_img = ashlar(1024, 0.36)
v, f, uv = cylinder_inner(R_WALL, 0, H_SPRING + 0.2, 96, 4.0, 3.0, rows=2)
wall = textured(v, f, uv, mat(wall_img, rough=0.9))
export('chamber_wall', [('wall', wall)])

# vault + ribs + springing ring + gallery + pilasters
v, f, uv = vault()
dome = textured(v, f, uv, mat(starmap(), rough=0.95))
rib_mat = mat(solid((150, 150, 152)), rough=0.7)
silver_mat = mat(solid((198, 199, 203)), rough=0.5, emissive=solid((70, 70, 72)), em_strength=1.0)
ribs = []
for deg in PILLAR_DEG:
    a = math.radians(deg)
    prev = None
    for k in range(21):
        r, h = vault_profile(k / 20 * 0.97)
        r -= 0.35
        h -= 0.35
        p = [math.sin(a) * r, h, math.cos(a) * r]
        if prev is not None:
            ribs.append(box_between(prev, p, 0.9, 0.7))
        prev = p
    # pilaster from the gallery to the springing line, above each pillar
    ribs.append(box_between([math.sin(a) * (R_WALL - 0.4), H_GALLERY, math.cos(a) * (R_WALL - 0.4)],
                            [math.sin(a) * (R_WALL - 0.4), H_SPRING, math.cos(a) * (R_WALL - 0.4)], 1.4, 0.8))
ribs_mesh = uv_box(ribs, rib_mat)
trim = []
for segs, r, y, w, hgt in [(72, R_WALL - 0.5, H_SPRING, 1.2, 0.5), (24, 2.6, H_APEX - 0.5, 0.5, 0.5)]:
    for i in range(segs):
        a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
        trim.append(box_between([math.sin(a0) * r, y, math.cos(a0) * r], [math.sin(a1) * r, y, math.cos(a1) * r], w, hgt))
trim_mesh = uv_box(trim, silver_mat)
# Gallery ledge: an annulus resting on pillar and arch tops, joining them to the wall.
gal = []
for i in range(72):
    a0, a1 = 2 * math.pi * i / 72, 2 * math.pi * (i + 1) / 72
    rm = (R_RING - 1.4 + R_WALL) / 2
    gal.append(box_between([math.sin(a0) * rm, H_GALLERY, math.cos(a0) * rm], [math.sin(a1) * rm, H_GALLERY, math.cos(a1) * rm], R_WALL - (R_RING - 1.4), 0.7))
gal_mesh = uv_box(gal, mat(ashlar(512, 0.44), rough=0.85))
gal_edge = []
for i in range(72):
    a0, a1 = 2 * math.pi * i / 72, 2 * math.pi * (i + 1) / 72
    r = R_RING - 1.45
    gal_edge.append(box_between([math.sin(a0) * r, H_GALLERY + 0.1, math.cos(a0) * r], [math.sin(a1) * r, H_GALLERY + 0.1, math.cos(a1) * r], 0.3, 0.9))
edge_mesh = uv_box(gal_edge, silver_mat)
export('chamber_vault', [('vault', dome), ('ribs', ribs_mesh), ('trim', trim_mesh), ('gallery', gal_mesh), ('gallery_edge', edge_mesh)])
