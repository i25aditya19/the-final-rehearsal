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


def draw(ax, heading):
    polys, cols, depth = [], [], []
    h = np.radians(heading)
    light = np.array([0.2, 0.6, -0.8]); light /= np.linalg.norm(light)
    for id_, g in G.items():
        tr = T[id_]['json']
        p = np.array([tr['position'][k] for k in 'xyz'])  # relative to arena root (centre)
        ang = np.degrees(np.arctan2(p[0], p[2])) % 360
        if min(abs(ang - heading) % 360, 360 - abs(ang - heading) % 360) > 50:
            continue
        src = f"{repo}/{g['json']['src']}"
        if src not in cache:
            cache[src] = trimesh.load(src, force='mesh')
        m = cache[src]
        S = np.array([tr['scale'][k] for k in 'xyz'])
        R = quat_to_mat(tr['rotation'])
        v = (m.vertices * S) @ R.T + p
        # rotate the world so this heading points to -Z (we look from the centre outward)
        Ry = np.array([[np.cos(h), 0, -np.sin(h)], [0, 1, 0], [np.sin(h), 0, np.cos(h)]])
        v = v @ Ry.T
        tri = v[m.faces]
        n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        shade = 0.4 + 0.6 * np.abs(n @ light)
        c = np.clip(face_colors(m) * shade[:, None], 0, 1)
        polys.append(tri[:, :, :2]); cols.append(c); depth.append(tri[:, :, 2].mean(1))
    polys = np.concatenate(polys); cols = np.concatenate(cols); d = np.concatenate(depth)
    o = np.argsort(-d)  # far (+z after rotation) first
    ax.add_collection(PolyCollection(polys[o], facecolors=cols[o], edgecolors='none'))
    ax.set_xlim(-22, 22); ax.set_ylim(-1, 27); ax.set_aspect('equal')
    ax.set_facecolor((0.32, 0.33, 0.4)); ax.set_xticks([]); ax.set_yticks([])
    ax.axhline(0, color='0.5', lw=1)
    ax.set_title(f'Chamber looking toward {int(heading)} deg from the centre', fontsize=9)


fig, axes = plt.subplots(1, len(headings), figsize=(7 * len(headings), 5), dpi=100)
for ax, hd in zip(np.atleast_1d(axes), headings):
    draw(ax, hd)
plt.tight_layout(); plt.savefig(out); print('saved', out)
