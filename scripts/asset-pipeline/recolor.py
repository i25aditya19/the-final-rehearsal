"""Recolour Watcher textures to the monochrome palette, keeping crimson only on the eye.
usage: python recolor.py in.glb outdir name mode size [eyeX eyeY eyeZ eyeRadius]
modes: mono (black/silver body), ivory (mask), silver (halo), pale (hands)
Writes <name>_base.jpg and, if an eye is given, <name>_emissive.jpg (eye glow only)."""
import sys
import numpy as np
import trimesh
from PIL import Image, ImageDraw

src, outdir, name, mode, size = sys.argv[1:6]
size = int(size)
eye = [float(x) for x in sys.argv[6:10]] if len(sys.argv) >= 10 else None

m = trimesh.load(src, force='mesh')
tex = m.visual.material.baseColorTexture.convert('RGB')
a = np.asarray(tex).astype(np.float32)
H, W = a.shape[:2]
lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])[..., None]

# Texels allowed to stay crimson: the UV footprint of faces within eyeRadius of the eye.
allowed = np.zeros((H, W), bool)
if eye:
    cen = m.vertices[m.faces].mean(1)
    near = np.linalg.norm(cen - np.array(eye[:3]), axis=1) < eye[3]
    mask_img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask_img)
    uv = m.visual.uv
    for f in m.faces[near]:
        pts = [((uv[i, 0] % 1) * (W - 1), (1 - uv[i, 1] % 1) * (H - 1)) for i in f]
        d.polygon(pts, fill=255)
    allowed = np.asarray(mask_img.filter(__import__('PIL.ImageFilter', fromlist=['x']).MaxFilter(9))) > 0
    print(f'{name}: {near.sum()} eye faces, {allowed.sum()} eye texels')

r, g, b = a[..., 0], a[..., 1], a[..., 2]
is_red = (r > 70) & (r > g * 1.6) & (r > b * 1.6)
keep_red = is_red & allowed

if mode == 'mono':
    out = np.repeat(lum, 3, axis=2)
elif mode == 'ivory':
    ivory = np.array([241, 239, 234], np.float32) / 241
    out = lum * ivory * 1.05
elif mode == 'silver':
    # Copper -> silver: luminance with lifted mids, a touch cool.
    l = lum / 255.0
    l = np.clip(0.08 + 1.25 * l ** 0.85, 0, 1) * 255
    out = l * np.array([0.97, 0.99, 1.03], np.float32)
elif mode == 'pale':
    ash = np.array([236, 234, 230], np.float32) / 236
    out = np.clip(lum * 1.08 + 8, 0, 255) * ash
elif mode == 'stone':
    # Environment: neutral grey stone, mids lifted so the chamber is not too dark.
    l = lum / 255.0
    l = np.clip(0.05 + 1.18 * l ** 0.88, 0, 1) * 255
    out = l * np.array([0.98, 0.985, 1.0], np.float32)
elif mode == 'cyan':
    # Friendly spectral echo: luminance tinted toward #85DFFF.
    l = np.clip(lum / 255.0 * 1.25 + 0.08, 0, 1)
    out = l * np.array([133, 223, 255], np.float32)
else:
    raise SystemExit('unknown mode')

out = np.where(keep_red[..., None], a * np.array([1.08, 0.75, 0.8], np.float32), out)
out = np.clip(out, 0, 255).astype(np.uint8)
base = Image.fromarray(out).resize((size, size), Image.LANCZOS)
base.save(f'{outdir}/{name}_base.jpg', quality=88)
print(f'{name}: base {size}px, kept red texels {int(keep_red.sum())}, removed red texels {int((is_red & ~allowed).sum())}')

if eye:
    em = np.zeros_like(a)
    em[keep_red] = np.array([197, 34, 63], np.float32)  # crimson #C5223F
    Image.fromarray(em.astype(np.uint8)).resize((256, 256), Image.BILINEAR).save(f'{outdir}/{name}_emissive.jpg', quality=90)
