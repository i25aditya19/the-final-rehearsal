# Asset manifest and credits

Every non-code file in the scene must be listed here before it is committed. The MIT license in `LICENSE` covers source code only.

| File | Source / tool | Author | License / terms | Generated / obtained | Attribution required | OK to redistribute in public repo |
| --- | --- | --- | --- | --- | --- | --- |
| images/scene-thumbnail.png | Decentraland SDK7 scene template | Decentraland | Apache-2.0 (SDK template) | 2026-11-25 | No | Yes (placeholder, replace before submission) |

| assets/boss/watcher_body.glb | Aholo (tex_mesh.glb), optimized by scripts/asset-pipeline | creator (generated with Aholo) | Aholo output; creator confirmed Aholo's terms allow publishing in this public repo (2026-11-25) | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_helm.glb | Aholo (tex_mesh.glb, head split) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_mask.glb | Aholo (tex_mesh_2.glb) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_halo.glb | Aholo (tex_mesh_1.glb) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |
| assets/boss/watcher_hand.glb | Aholo (tex_mesh_3.glb) | creator (Aholo) | Aholo output; creator-confirmed terms | 2026-11-25 | Credit "Aholo" | Yes |

On 2026-11-25 the creator confirmed that Aholo's terms and conditions allow publishing these models on GitHub. They are optimized derivatives of the creator's Aholo generations (see scripts/asset-pipeline). The repository's MIT license covers the code; the models remain subject to Aholo's terms. The game falls back to a primitive Watcher if they are absent. Arena and effects are procedural SDK primitives.

| assets/images/glow.png, spark.png | generated procedurally for this project (Python/PIL) | project | MIT (with the code) | 2026-11-25 | No | Yes |

## Third-party code

- Decentraland SDK7 (`@dcl/sdk`, `@dcl/js-runtime`): Apache-2.0, installed via npm, not vendored.
- Decentraland SDK skills: development aid only, not committed and not deployed. Reinstall with `npx skills add decentraland/sdk-skills --all` (version pinned in `skills-lock.json`).
