# Asset manifest and credits

Every non-code file in the scene must be listed here before it is committed. The MIT license in `LICENSE` covers source code only.

| File | Source / tool | Author | License / terms | Generated / obtained | Attribution required | OK to redistribute in public repo |
| --- | --- | --- | --- | --- | --- | --- |
| images/scene-thumbnail.png | Decentraland SDK7 scene template | Decentraland | Apache-2.0 (SDK template) | 2026-11-25 | No | Yes (placeholder, replace before submission) |

| assets/boss/watcher_body.glb | Aholo (tex_mesh.glb), optimized by scripts/asset-pipeline | creator (generated with Aholo) | Aholo output; creator confirmed Aholo's terms allow publishing in this public repo (2026-11-25) | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_helm.glb | Aholo (tex_mesh.glb, head split) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_mask.glb | Aholo (tex_mesh_2.glb) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_halo.glb | Aholo (tex_mesh_1.glb) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |
| assets/echoes/spectral_echo.glb | Aholo (tex_mesh_4.glb, 399,904 tris); 2,482 tris, cyan-tinted, translucent | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/wall_silhouette.glb | Aholo (tex_mesh_4.glb); 1,500 tris, grey translucent variant for wall silhouettes | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/astro_rings.glb | Aholo (tex_mesh_5.glb, 400,180 tris); 2,966 tris, silver | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/chamber_door.glb | Aholo (tex_mesh_6.glb, 362,436 tris); 3,972 tris, bronze/brown removed | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/gothic_arch.glb | Aholo (tex_mesh_7.glb, 532,242 tris); 2,962 tris | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/gothic_window.glb | Aholo (tex_mesh_8.glb, 370,280 tris); 2,486 tris, brown removed, soft emissive glass | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/gothic_pillar.glb | Aholo (tex_mesh_9.glb, 415,054 tris); 2,474 tris | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/floating_candle.glb | Aholo (tex_mesh_10.glb, 278,802 tris); 300 tris, ivory | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/environment/astro_clock.glb | Aholo (tex_mesh_11.glb, 408,984 tris); 3,984 tris, bronze -> silver | creator (Aholo) | Aholo output; creator confirmed Aholo terms allow publishing | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_hand.glb | Aholo (tex_mesh_3.glb) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |

On 2026-11-25 the creator confirmed that Aholo's terms and conditions allow publishing these models on GitHub. They are optimized derivatives of the creator's Aholo generations (see scripts/asset-pipeline). The repository's MIT license covers the code; the models remain subject to Aholo's terms. The game falls back to a primitive Watcher if they are absent. Arena and effects are procedural SDK primitives.

| assets/environment/chamber_floor.glb, chamber_wall.glb, chamber_vault.glb | generated procedurally for this project (scripts/asset-pipeline/build_chamber_shell.py) | project | MIT (with the code) | 2026-11-25 | No | Yes |
| assets/images/glow.png, spark.png | generated procedurally for this project (Python/PIL) | project | MIT (with the code) | 2026-11-25 | No | Yes |

## Third-party code

- Decentraland SDK7 (`@dcl/sdk`, `@dcl/js-runtime`): Apache-2.0, installed via npm, not vendored.
- Decentraland SDK skills: development aid only, not committed and not deployed. Reinstall with `npx skills add decentraland/sdk-skills --all` (version pinned in `skills-lock.json`).


Optimization and recolouring for all Aholo models: `scripts/asset-pipeline/` (README there; `env_batch.sh` for the environment set). Originals are not stored in the repo.
