"""Procedural chamber shell for THE FINAL REHEARSAL (original geometry and textures).

Writes into assets/environment/:
  chamber_floor.glb  - astronomical ritual marble disc (r = 23.4 m), gameplay rings baked in
  chamber_wall.glb   - continuous ashlar wall (inner face) from the floor to the vault springing
  chamber_vault.glb  - pointed ribbed dome with a silver star map, ribs above each pillar,
                       springing ring, gallery ledge joining pillar tops to the wall, pilasters
All dimensions come from the arena constants below (keep in sync with src/config.ts ARENA).
usage: python build_chamber_shell.py <repoDir>
"""
import sys, math, io
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


def jpeg(img, q=88):
    """Re-open as JPEG so trimesh embeds a compact JPEG instead of a PNG."""
    b = io.BytesIO()
    img.convert('RGB').save(b, 'JPEG', quality=q)
    b.seek(0)
    return Image.open(b)


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


R_FLOOR = R_WALL  # the floor now runs right up to the chamber wall (no outside ground visible)


def marble_floor(size=4096):
    """Dark polished charcoal marble with silver/white veins and astronomical engravings:
    concentric celestial circles, crescent moons and stars, a central eye emblem, silver ritual
    markings, and the gameplay guides (0.75 R / 0.5 R rings, playable edge, quadrant lines,
    N/E/S/W runes) kept clearly readable."""
    n = fbm(size, 7, 1)
    n2 = fbm(size, 5, 9)
    x = np.linspace(-1, 1, size)
    X, Y = np.meshgrid(x, x)
    v1 = 1 - np.clip(np.abs(np.sin((X * 2.3 + Y * 1.1 + n * 6.0) * math.pi)) * 9, 0, 1)
    v2 = 1 - np.clip(np.abs(np.sin((X * -1.4 + Y * 2.9 + n2 * 4.0) * math.pi)) * 14, 0, 1)
    base = 0.115 + 0.05 * n + 0.20 * v1 + 0.12 * v2      # charcoal with silver-white veins
    rad = np.sqrt(X ** 2 + Y ** 2) * R_FLOOR
    base = np.where(rad > R_PLAY + 0.25, base * 0.72, base)  # darker border band to the wall
    rgb = np.stack([base, base * 1.0, base * 1.025], -1)
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    c = size / 2
    s = size / 2 / R_FLOOR
    W = lambda m: max(1, int(m * s))
    silver = (190, 192, 198)
    dim = (118, 120, 126)
    ivory = (232, 228, 218)

    def circle(r, w, col):
        d.ellipse([c - r * s, c - r * s, c + r * s, c + r * s], outline=col, width=W(w))

    def pt(r, deg):
        a = math.radians(deg)
        return c + math.sin(a) * r * s, c - math.cos(a) * r * s

    def star(r, deg, size_m, col, points=4):
        cx, cy = pt(r, deg)
        poly = []
        for k in range(points * 2):
            rr = size_m * (1 if k % 2 == 0 else 0.32) * s
            a = math.pi * k / points
            poly.append((cx + math.sin(a) * rr, cy - math.cos(a) * rr))
        d.polygon(poly, fill=col)

    def crescent(r, deg, size_m, col, bg):
        cx, cy = pt(r, deg)
        rr = size_m * s
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col)
        a = math.radians(deg + 90)
        ox, oy = math.sin(a) * rr * 0.42, -math.cos(a) * rr * 0.42
        d.ellipse([cx - rr + ox, cy - rr + oy, cx + rr + ox, cy + rr + oy], fill=bg)

    bg = (34, 34, 37)
    # Playable edge: double silver line with a band of 96 ticks.
    circle(R_PLAY, 0.12, silver)
    circle(R_PLAY - 0.45, 0.04, dim)
    for i in range(96):
        a = i * 3.75
        r0 = R_PLAY - (0.45 if i % 4 else 0.85)
        d.line([pt(r0, a), pt(R_PLAY, a)], fill=dim, width=W(0.035))
    # Outer celestial ring (moon phases) between the playable edge and the wall.
    circle(R_PLAY + 2.6, 0.05, dim)
    for i in range(16):
        deg = i * 22.5 + 11.25
        crescent(R_PLAY + 1.4, deg, 0.42, (200, 200, 205), bg)
    # Zodiac ring with twelve houses, stars and original glyph marks.
    circle(17.4, 0.06, silver)
    circle(15.6, 0.06, silver)
    for i in range(12):
        d.line([pt(15.6, i * 30), pt(17.4, i * 30)], fill=silver, width=W(0.05))
        star(16.5, i * 30 + 15, 0.38, ivory, 4 if i % 2 else 5)
    # Gameplay rings: bright silver so positioning stays readable.
    for r in (R_PLAY * 0.75, R_PLAY * 0.5):
        circle(r, 0.10, silver)
        circle(r + 0.22, 0.03, dim)
    # Quadrant boundaries (diagonals) from the dais to the edge: thin, steady silver.
    for k in range(4):
        d.line([pt(DAIS + 0.4, 45 + k * 90), pt(R_PLAY - 0.5, 45 + k * 90)], fill=dim, width=W(0.07))
    # N/E/S/W runes: ivory diamonds with a small star (sector identity).
    for k in range(4):
        cx, cy = pt(R_PLAY * 0.875, k * 90)
        rr = 0.6 * s
        d.polygon([(cx, cy - rr), (cx + rr, cy), (cx, cy + rr), (cx - rr, cy)], outline=ivory, width=W(0.06))
        star(R_PLAY * 0.875, k * 90, 0.28, ivory, 4)
    # Scattered small stars across the floor.
    r2 = np.random.default_rng(3)
    for _ in range(140):
        rr = r2.uniform(DAIS + 1.5, R_PLAY - 1.2)
        if abs(rr - 16.5) < 1.3 or abs(rr - R_PLAY * 0.75) < 0.5 or abs(rr - R_PLAY * 0.5) < 0.5:
            continue
        star(rr, r2.uniform(0, 360), r2.uniform(0.06, 0.16), (150, 152, 158), 4)
    # Eight-pointed ritual star and the central eye emblem around the dais.
    poly = [pt(8.6 if i % 2 == 0 else 6.0, i * 22.5) for i in range(16)]
    d.polygon(poly, outline=silver, width=W(0.05))
    circle(DAIS + 0.15, 0.12, silver)
    d.ellipse([c - DAIS * s, c - DAIS * s, c + DAIS * s, c + DAIS * s], fill=(22, 22, 25))
    # Eye: a vesica (almond) with iris and pupil, aligned north-south.
    ew, eh = 3.6 * s, 1.75 * s
    top = [(c + ew * math.cos(t), c - eh * math.sin(t)) for t in np.linspace(0, math.pi, 40)]
    bot = [(c + ew * math.cos(t), c + eh * math.sin(t)) for t in np.linspace(math.pi, 0, 40)]
    d.polygon(top + bot, outline=silver, width=W(0.07))
    d.ellipse([c - 1.25 * s, c - 1.25 * s, c + 1.25 * s, c + 1.25 * s], outline=silver, width=W(0.06))
    d.ellipse([c - 0.45 * s, c - 0.45 * s, c + 0.45 * s, c + 0.45 * s], fill=(150, 30, 52))
    for k in range(12):  # eyelash rays
        a = math.radians(-60 + k * 10.9)
        d.line([(c + math.sin(a) * 2.2 * s, c - math.cos(a) * 2.2 * s * 0.9), (c + math.sin(a) * 2.9 * s, c - math.cos(a) * 2.9 * s * 0.9)], fill=dim, width=W(0.04))
    img = img.filter(ImageFilter.SMOOTH)
    return img


def parapet_texture(size=1024):
    """One 3 m bay of the low boundary wall: recessed panel with a pointed arch relief, a carved
    celestial symbol, silver border lines and stone mouldings (tiles horizontally)."""
    n = fbm(size, 6, 21)
    tone = 0.27 + 0.05 * (n - 0.5)
    img = np.stack([tone, tone, tone * 1.02], -1)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    S = size
    # mouldings: base plinth and top band (darker), silver fillets
    d.rectangle([0, int(S * 0.86), S, S], fill=(46, 46, 49))
    d.rectangle([0, 0, S, int(S * 0.1)], fill=(52, 52, 55))
    d.line([(0, int(S * 0.1)), (S, int(S * 0.1))], fill=(178, 180, 186), width=6)
    d.line([(0, int(S * 0.86)), (S, int(S * 0.86))], fill=(150, 152, 158), width=4)
    # recessed pointed (equilateral) Gothic arch panel: each side is an arc centred on the
    # opposite springing point, meeting in a point at the top.
    l, r, b, spring = int(S * 0.16), int(S * 0.84), int(S * 0.8), int(S * 0.42)
    w = r - l
    cx = S / 2
    rise = math.sqrt(w * w - (w / 2) ** 2)
    k = (spring - S * 0.14) / rise
    left = [(x, spring - k * math.sqrt(max(0, w * w - (x - r) ** 2))) for x in np.linspace(l, cx, 30)]
    right = [(x, spring - k * math.sqrt(max(0, w * w - (x - l) ** 2))) for x in np.linspace(cx, r, 30)]
    arch = [(l, b)] + left + right + [(r, b)]
    d.polygon(arch, fill=(30, 30, 33), outline=(160, 162, 168))
    # inner arch line
    inset = 0.86
    arch2 = [(cx + (x - cx) * inset, spring + (y - spring) * inset + S * 0.03) for (x, y) in left + right]
    d.line(arch2, fill=(96, 98, 104), width=3)
    # carved astrolabe: two rings, an eight-pointed star and four small dots
    cy = S * 0.56
    for rr in (S * 0.13, S * 0.095):
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(176, 178, 184), width=5)
    pts = []
    for q in range(16):
        a = math.pi * q / 8
        rr = S * (0.085 if q % 2 == 0 else 0.03)
        pts.append((cx + math.sin(a) * rr, cy - math.cos(a) * rr))
    d.polygon(pts, fill=(200, 200, 206))
    for q in range(4):
        a = math.pi / 4 + q * math.pi / 2
        dx, dy = math.sin(a) * S * 0.16, -math.cos(a) * S * 0.16
        d.ellipse([cx + dx - 6, cy + dy - 6, cx + dx + 6, cy + dy + 6], fill=(176, 178, 184))
    return im.filter(ImageFilter.SMOOTH)


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
v, f, uv = disc(R_FLOOR, 160, 0.0)
export('chamber_floor', [('floor', textured(v, f, uv, mat(jpeg(marble_floor(), 90), rough=0.6)))])

# wall: lower and upper courses, ashlar texture (tiles every 4 m x 3 m)
wall_img = jpeg(ashlar(1024, 0.27))
v, f, uv = cylinder_inner(R_WALL, 0, H_SPRING + 0.2, 96, 4.0, 3.0, rows=2)
wall = textured(v, f, uv, mat(wall_img, rough=0.9))
export('chamber_wall', [('wall', wall)])

# vault + ribs + springing ring + gallery + pilasters
v, f, uv = vault()
dome = textured(v, f, uv, mat(jpeg(starmap(), 88), rough=0.95))
rib_mat = mat(jpeg(ashlar(256, 0.42)), rough=0.85)
silver_mat = mat(solid((176, 178, 184)), rough=0.6)
cornice_mat = mat(jpeg(ashlar(256, 0.2)), rough=0.9)
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
CORNICES = [(72, R_WALL - 0.55, H_SPRING, 1.3, 0.75), (24, 2.6, H_APEX - 0.5, 0.6, 0.6)]
FILLETS = [(72, R_WALL - 1.22, H_SPRING - 0.2, 0.08, 0.08), (24, 2.0, H_APEX - 0.75, 0.06, 0.06)]
corn = []
for segs, r, y, w, hgt in CORNICES:
    for i in range(segs):
        a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
        corn.append(box_between([math.sin(a0) * r, y, math.cos(a0) * r], [math.sin(a1) * r, y, math.cos(a1) * r], w, hgt))
cornice_mesh = uv_box(corn, cornice_mat)
for segs, r, y, w, hgt in FILLETS:
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
gal_mesh = uv_box(gal, mat(jpeg(ashlar(512, 0.3)), rough=0.85))
gal_edge = []
for i in range(72):
    a0, a1 = 2 * math.pi * i / 72, 2 * math.pi * (i + 1) / 72
    r = R_RING - 1.45
    gal_edge.append(box_between([math.sin(a0) * r, H_GALLERY + 0.1, math.cos(a0) * r], [math.sin(a1) * r, H_GALLERY + 0.1, math.cos(a1) * r], 0.35, 0.9))
edge_mesh = uv_box(gal_edge, cornice_mat)
export('chamber_vault', [('vault', dome), ('ribs', ribs_mesh), ('cornice', cornice_mesh), ('trim', trim_mesh), ('gallery', gal_mesh), ('gallery_edge', edge_mesh)])

# Low boundary parapet: reduced visual height (1.6 m), carved panels, silver mouldings.
# Collision stays a separate invisible taller ring in the composite.
R_PAR, H_PAR = R_WALLLOW, 1.6
segs = 96
bay = 3.0
circ = 2 * math.pi * R_PAR
verts, uvs, faces = [], [], []
for side, r in (('in', R_PAR - 0.35), ('out', R_PAR + 0.35)):
    base_i = len(verts)
    for i in range(segs + 1):
        a = 2 * math.pi * i / segs
        for k, y in enumerate((0.0, H_PAR)):
            verts.append([math.sin(a) * r, y, math.cos(a) * r])
            uvs.append([circ * i / segs / bay, k * 1.0])
    for i in range(segs):
        p0 = base_i + i * 2
        if side == 'in':
            faces += [[p0, p0 + 1, p0 + 2], [p0 + 1, p0 + 3, p0 + 2]]
        else:
            faces += [[p0, p0 + 2, p0 + 1], [p0 + 1, p0 + 2, p0 + 3]]
par = textured(np.array(verts), np.array(faces), np.array(uvs), mat(jpeg(parapet_texture()), rough=0.85))
cap = []
for i in range(segs):
    a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
    cap.append(box_between([math.sin(a0) * R_PAR, H_PAR + 0.06, math.cos(a0) * R_PAR], [math.sin(a1) * R_PAR, H_PAR + 0.06, math.cos(a1) * R_PAR], 0.95, 0.14))
cap_mesh = uv_box(cap, cornice_mat)
fil = []
for i in range(segs):
    a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
    r = R_PAR - 0.5
    fil.append(box_between([math.sin(a0) * r, H_PAR + 0.15, math.cos(a0) * r], [math.sin(a1) * r, H_PAR + 0.15, math.cos(a1) * r], 0.06, 0.05))
fil_mesh = uv_box(fil, silver_mat)
export('chamber_parapet', [('parapet', par), ('coping', cap_mesh), ('fillet', fil_mesh)])
