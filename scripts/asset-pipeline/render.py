"""Tiny software preview renderer for textured GLBs (painter's algorithm, per-face texture colour,
Lambert + ambient). usage: python render.py out.png in1.glb[:label[:yawDeg]] ...  (one panel each)"""
import sys
import numpy as np
import trimesh
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection


def load(path):
    s = trimesh.load(path, force='scene')
    meshes = []
    for name, geom in s.geometry.items():
        T = s.graph.get(s.graph.nodes_geometry[0])[0] if False else np.eye(4)
        meshes.append(geom)
    m = meshes[0] if len(meshes) == 1 else trimesh.util.concatenate(meshes)
    return m


def face_colors(m):
    try:
        img = m.visual.material.baseColorTexture
        uv = m.visual.uv
    except Exception:
        img = None
    if img is None:
        return np.tile([0.6, 0.6, 0.6], (len(m.faces), 1))
    a = np.asarray(img.convert('RGB')).astype(float) / 255.0
    h, w = a.shape[:2]
    cols = np.zeros((len(m.faces), 3))
    # sample at the three corners and centroid
    samples = [uv[m.faces[:, i]] for i in range(3)] + [uv[m.faces].mean(1)]
    for s in samples:
        x = np.clip((s[:, 0] % 1.0) * (w - 1), 0, w - 1).astype(int)
        y = np.clip((1 - (s[:, 1] % 1.0)) * (h - 1), 0, h - 1).astype(int)
        cols += a[y, x]
    return cols / len(samples)


def render(ax, m, yaw, label):
    v = m.vertices.copy()
    r = np.radians(yaw)
    R = np.array([[np.cos(r), 0, np.sin(r)], [0, 1, 0], [-np.sin(r), 0, np.cos(r)]])
    v = v @ R.T
    tri = v[m.faces]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    nl = np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    n = n / nl
    light = np.array([0.3, 0.5, 0.8]); light /= np.linalg.norm(light)
    shade = 0.35 + 0.65 * np.abs(n @ light)  # double-sided
    cols = np.clip(face_colors(m) * shade[:, None], 0, 1)
    depth = tri[:, :, 2].mean(1)
    order = np.argsort(depth)  # far (-z) first; camera looks from +z
    polys = tri[order][:, :, :2]
    pc = PolyCollection(polys, facecolors=cols[order], edgecolors='none', linewidths=0)
    ax.add_collection(pc)
    mn, mx = v.min(0), v.max(0)
    c = (mn + mx) / 2
    span = (mx - mn)[:2].max() * 0.55
    ax.set_xlim(c[0] - span, c[0] + span)
    ax.set_ylim(c[1] - span, c[1] + span)
    ax.set_aspect('equal')
    ax.set_facecolor((0.55, 0.6, 0.68))
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_title(f'{label}  ({len(m.faces):,} tris)', fontsize=9)


if __name__ == '__main__':
    out = sys.argv[1]
    specs = sys.argv[2:]
    fig, axes = plt.subplots(1, len(specs), figsize=(3.2 * len(specs), 4.2), dpi=110)
    axes = np.atleast_1d(axes)
    cache = {}
    for ax, spec in zip(axes, specs):
        parts = spec.split(':')
        path, label, yaw = parts[0], (parts[1] if len(parts) > 1 else path), float(parts[2]) if len(parts) > 2 else 0
        if path not in cache:
            cache[path] = load(path)
        render(ax, cache[path], yaw, label)
    plt.tight_layout()
    plt.savefig(out)
    print('saved', out)
