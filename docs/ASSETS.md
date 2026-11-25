# Asset manifest and credits

Every non-code file in the scene must be listed here before it is committed. The MIT license in `LICENSE` covers source code only.

| File | Source / tool | Author | License / terms | Generated / obtained | Attribution required | OK to redistribute in public repo |
| --- | --- | --- | --- | --- | --- | --- |
| images/scene-thumbnail.png | Decentraland SDK7 scene template | Decentraland | Apache-2.0 (SDK template) | 2026-11-25 | No | Yes (placeholder, replace before submission) |

All other visuals are currently procedural SDK primitives (no external files).

## Third-party code

- Decentraland SDK7 (`@dcl/sdk`, `@dcl/js-runtime`): Apache-2.0, installed via npm, not vendored.
- Decentraland SDK skills: development aid only, not committed and not deployed. Reinstall with `npx skills add decentraland/sdk-skills --all` (version pinned in `skills-lock.json`).
