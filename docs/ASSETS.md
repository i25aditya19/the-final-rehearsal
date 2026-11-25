# Asset manifest and credits

Every non-code file in the scene must be listed here before it is committed. The MIT license in `LICENSE` covers source code only.

| File | Source / tool | Author | License / terms | Generated / obtained | Attribution required | OK to redistribute in public repo |
| --- | --- | --- | --- | --- | --- | --- |
| images/scene-thumbnail.png | Decentraland SDK7 scene template | Decentraland | Apache-2.0 (SDK template) | 2026-11-25 | No | Yes (placeholder, replace before submission) |

| assets/boss/watcher_body.glb | Aholo (tex_mesh.glb), optimized by scripts/asset-pipeline | creator (generated with Aholo) | **Aholo terms: pending creator confirmation** | 2026-11-25 | TBD | **Not yet**: kept out of git |
| assets/boss/watcher_helm.glb | Aholo (tex_mesh.glb, head split) | creator (Aholo) | pending | 2026-11-25 | TBD | Not yet |
| assets/boss/watcher_mask.glb | Aholo (tex_mesh_2.glb) | creator (Aholo) | pending | 2026-11-25 | TBD | Not yet |
| assets/boss/watcher_halo.glb | Aholo (tex_mesh_1.glb) | creator (Aholo) | pending | 2026-11-25 | TBD | Not yet |
| assets/boss/watcher_hand.glb | Aholo (tex_mesh_3.glb) | creator (Aholo) | pending | 2026-11-25 | TBD | Not yet |

The Watcher GLBs are listed in `.gitignore` until Aholo's terms are confirmed to allow public, open-source redistribution. The game falls back to a primitive Watcher when they are absent. Arena and effects are procedural SDK primitives.

## Third-party code

- Decentraland SDK7 (`@dcl/sdk`, `@dcl/js-runtime`): Apache-2.0, installed via npm, not vendored.
- Decentraland SDK skills: development aid only, not committed and not deployed. Reinstall with `npx skills add decentraland/sdk-skills --all` (version pinned in `skills-lock.json`).
