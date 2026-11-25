"""Render the assembled Watcher as laid out in src/boss/watcher.ts (static pose).
usage: python assemble_render.py out.png assetsDir"""
import sys
import numpy as np
import trimesh
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
sys.path.insert(0, '/home/claude/tools')
from render import face_colors  # noqa: E402

out, d = sys.argv[1], sys.argv[2]
S = 1.3
head = np.array([0, 1.78 * S, -0.6])


def T(pos=(0, 0, 0), scale=(1, 1, 1), rot_deg=(0, 0, 0)):
    M = np.eye(4)
    rx, ry, rz = np.radians(rot_deg)
    Rx = trimesh.transformations.rotation_matrix(rx, [1, 0, 0])
    Ry = trimesh.transformations.rotation_matrix(ry, [0, 1, 0])
    Rz = trimesh.transformations.rotation_matrix(rz, [0, 0, 1])
    M = trimesh.transformations.translation_matrix(pos) @ Ry @ Rx @ Rz @ np.diag([*scale, 1])
    return M


def parts(visage):
    L = lambda n: trimesh.load(f'{d}/{n}.glb', force='mesh')
    P = [(L('watcher_body'), T(scale=(S, S, S)))]
    if visage == 'helm':
        P.append((L('watcher_helm'), T(scale=(S, S, S))))
    else:
        k = 1.9 * S
        P.append((L('watcher_mask'), T(pos=(0, 1.78 * S, 0.15 * S), scale=(k, k, k))))
    halo = L('watcher_halo')
    for i, dia in enumerate([1.5, 2.15, 2.8]):
        k = dia / 0.3
        P.append((halo, T(pos=head, scale=(k, k, k), rot_deg=((i - 1) * 4, 0, i * 25))))
    hand = L('watcher_hand')
    for x in (-2.0, 2.0):
        side = -1 if x < 0 else 1
        P.append((hand, T(pos=(x, 0.2, 0.7), scale=(side * 1.6, 1.6, 1.6), rot_deg=(-10, side * 20, side * -12))))
    return P


def draw(ax, P, yaw, title):
    polys, cols, depths = [], [], []
    R = trimesh.transformations.rotation_matrix(np.radians(yaw), [0, 1, 0])
    light = np.array([0.3, 0.5, 0.8]); light /= np.linalg.norm(light)
    total = 0
    for m, M in P:
        v = trimesh.transform_points(m.vertices, R @ M)
        tri = v[m.faces]
        n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        shade = 0.35 + 0.65 * np.abs(n @ light)
        c = np.clip(face_colors(m) * shade[:, None], 0, 1)
        polys.append(tri[:, :, :2]); cols.append(c); depths.append(tri[:, :, 2].mean(1))
        total += len(m.faces)
    polys = np.concatenate(polys); cols = np.concatenate(cols); depth = np.concatenate(depths)
    o = np.argsort(depth)
    ax.add_collection(PolyCollection(polys[o], facecolors=cols[o], edgecolors='none'))
    ax.set_xlim(-3.2, 3.2); ax.set_ylim(-3.0, 4.6); ax.set_aspect('equal')
    ax.set_facecolor((0.25, 0.26, 0.3)); ax.set_xticks([]); ax.set_yticks([])
    ax.axhline(-3.05, color='0.6', lw=1)  # floor (root is 3.05 m up)
    ax.set_title(f'{title}  ({total:,} tris)', fontsize=9, color='w')


fig, axes = plt.subplots(1, 3, figsize=(13, 5.6), dpi=110, facecolor=(0.12, 0.12, 0.14))
helm = parts('helm'); maskp = parts('mask')
draw(axes[0], helm, 0, 'Phases I-II: front')
draw(axes[1], helm, 35, 'Phases I-II: three-quarter')
draw(axes[2], maskp, 0, 'Final transformation: ivory mask')
plt.tight_layout(); plt.savefig(out, facecolor=fig.get_facecolor())
print('saved', out)
