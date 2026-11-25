"""Software preview of a chamber section as seen from the arena centre (orthographic).
usage: python chamber_render.py out.png repoDir headingDeg [headingDeg2]"""
import sys, json
import numpy as np
import trimesh
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
sys.path.insert(0, '/home/claude/tools')
from render import face_colors

out, repo = sys.argv[1], sys.argv[2]
headings = [float(h) for h in sys.argv[3:]]
comp = json.load(open(f'{repo}/assets/scene/main.composite'))
C = {c['name']: c['data'] for c in comp['components']}
G = C['core::GltfContainer']; T = C['core::Transform']; N = C['core-schema::Name']
cache = {}


def quat_to_mat(q):
    x, y, z, w = q['x'], q['y'], q['z'], q['w']
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])


POLYS, COLS, DEPTH, HEAD, AX = [], [], [], [0], [None]


def draw(ax, heading):
    POLYS.clear(); COLS.clear(); DEPTH.clear(); HEAD[0] = heading; AX[0] = ax
    for id_, g in G.items():
        tr = T[id_]['json']
        p = np.array([tr['position'][k] for k in 'xyz'])  # relative to arena root (centre)
        ang = np.degrees(np.arctan2(p[0], p[2])) % 360
        whole = np.linalg.norm(p[[0, 2]]) < 1
        if not whole and min(abs(ang - heading) % 360, 360 - abs(ang - heading) % 360) > 50:
            continue
        src = f"{repo}/{g['json']['src']}"
        if src not in cache:
            sc = trimesh.load(src, force='scene')
            cache[src] = list(sc.geometry.values())
        for m in cache[src]:
            add_mesh(m, tr, p, whole)
    return finish()


def add_mesh(m, tr, p, whole):
        h = np.radians(HEAD[0])
        light = np.array([0.2, 0.6, -0.8]); light /= np.linalg.norm(light)
        S = np.array([tr['scale'][k] for k in 'xyz'])
        R = quat_to_mat(tr['rotation'])
        v = (m.vertices * S) @ R.T + p
        # rotate the world so this heading points to -Z (we look from the centre outward)
        Ry = np.array([[np.cos(h), 0, -np.sin(h)], [0, 1, 0], [np.sin(h), 0, np.cos(h)]])
        v = v @ Ry.T
        tri = v[m.faces]
        cen = ((m.vertices * S) @ R.T + p)[m.faces].mean(1)
        if whole:
            ang = np.degrees(np.arctan2(cen[:, 0], cen[:, 2])) % 360
            dd = np.minimum(np.abs(ang - HEAD[0]) % 360, 360 - np.abs(ang - HEAD[0]) % 360)
            keep = (dd < 48) & (np.hypot(cen[:, 0], cen[:, 2]) > 6) & (cen[:, 1] < 30)
            if not keep.any():
                return
            tri = tri[keep]
            sel = keep
        else:
            sel = slice(None)
        n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        shade = 0.4 + 0.6 * np.abs(n @ light)
        c = np.clip(face_colors(m)[sel] * shade[:, None], 0, 1)
        POLYS.append(tri[:, :, :2]); COLS.append(c); DEPTH.append(tri[:, :, 2].mean(1))


def finish():
    ax = AX[0]
    polys = np.concatenate(POLYS); cols = np.concatenate(COLS); d = np.concatenate(DEPTH)
    o = np.argsort(-d)  # far (+z after rotation) first
    ax.add_collection(PolyCollection(polys[o], facecolors=cols[o], edgecolors='none'))
    heading = HEAD[0]
    ax.set_xlim(-24, 24); ax.set_ylim(-1, 30); ax.set_aspect('equal')
    ax.set_facecolor((0.32, 0.33, 0.4)); ax.set_xticks([]); ax.set_yticks([])
    ax.axhline(0, color='0.5', lw=1)
    ax.set_title(f'Chamber looking toward {int(heading)} deg from the centre', fontsize=9)


fig, axes = plt.subplots(1, len(headings), figsize=(7 * len(headings), 5), dpi=100)
for ax, hd in zip(np.atleast_1d(axes), headings):
    draw(ax, hd)
plt.tight_layout(); plt.savefig(out); print('saved', out)
