# Watcher asset pipeline

How the Aholo-generated Watcher models were turned into the game-ready files in `assets/boss/`.
The original AI files are kept outside the repo (about 72 MB, about 1.16 M triangles).

Tools: `npm i @gltf-transform/cli@4` (bundles meshoptimizer 1.2) and
`pip install trimesh pygltflib numpy pillow matplotlib`.

| Source file (Aholo) | Game file | Triangles | Notes |
| --- | --- | --- | --- |
| tex_mesh.glb (body, 311,696 tris) | watcher_body.glb | 10,984 | split at y = 1.59 (below the helm) |
| tex_mesh.glb | watcher_helm.glb | 1,999 | the head/helm above y = 1.59, same frame as the body, crimson eye glow |
| tex_mesh_2.glb (mask, 216,010) | watcher_mask.glb | 2,498 | ivory, crimson eye glow; replaces the helm for the final transformation |
| tex_mesh_1.glb (halo, 292,984) | watcher_halo.glb | 1,500 | copper recoloured to silver; instanced 3x |
| tex_mesh_3.glb (hand, 335,386) | watcher_hand.glb | 2,000 | grey-green recoloured to pale ash; instanced 2x (left mirrored) |

Steps per model:
1. `gltf-transform weld in.glb welded.glb`
2. `node simplify.mjs welded.glb simple.glb <targetTris> 0.05 0.5 [above:Y|below:Y]`.
   The UV atlas of AI meshes is cut into thousands of islands, so the standard simplifier stalls;
   meshoptimizer's *Permissive* mode (UV-weighted) reaches the target with around 0.3 % geometric error.
3. `python recolor.py simple.glb outdir <name> mono|ivory|silver|pale <size> [eyeX eyeY eyeZ radius]`:
   palette correction; red is kept only on the UV footprint of faces near the eye, and an emissive
   map is written for the eye glow.
4. `node finalize.mjs simple.glb out.glb base.jpg <metallic> <roughness> [emissive.jpg]`:
   JPEG base colour (1024 for body/mask, 512 for others), metallic-roughness texture replaced by
   constant factors, prune + dedup.
5. Check with `gltf-transform validate` and the preview renders (`render.py`, `assemble_render.py`).
