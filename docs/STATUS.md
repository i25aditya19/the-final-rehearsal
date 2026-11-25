# Implementation status

Deadline: **30 Nov 2026 23:59 UTC** (1 Dec 05:29 IST). Deploy permissions on `rgl10.dcl.eth` are revoked after the deadline, and any later deploy means disqualification.
Target: working deploy by 29 Nov, final deploy with margin before the deadline.

## Milestones

| | Milestone | State |
| --- | --- | --- |
| M0 | Setup: SDK7 scaffold, skills, World config, build | **Done** (verified in local preview) |
| M1 | Greybox arena, placeholder Watcher, Imprint shot | **Done**: creator verified in Chrome 2026-11-25 (6/7 hits, HP bar, sectors, ~30 FPS) |
| M2 | Echoes, repeat timing, Convergence (go/no-go) | **Built, build + 25 unit tests pass; creator playtest pending (go/no-go)** |
| M3 | Player HP, Gaze, Aftershock, victory/defeat/retry | Not started |
| M4 | Corruption, Blind Spot, phase gates, final barrier, timeout | Not started |
| M5 | Real Watcher and chamber assets | Not started |
| M6 | Telegraph/FX/audio polish, HUD, results, ending | Not started |
| M7 | Playtests, tuning, licensing check, deploy, submission | Not started |

## M0 record

- Node v22, npm 10.9; `@dcl/sdk` and `@dcl/js-runtime` pinned to **7.33.0**.
- Scaffold: `npx @dcl/sdk-commands@7.33.0 init --yes --project scene-template` (official template), template demo code removed.
- Skills: `npx skills add decentraland/sdk-skills --all` → `.agents/skills/` (commit `8c01cac`, pinned in `skills-lock.json`; not committed, reinstall locally with the same command).
- `scene.json`: 9 parcels `0,0`–`2,2` (48×48 m), `worldConfiguration.name = rgl10.dcl.eth`, fixed night skybox (22:00), spawn on the south side facing the centre (24, 3, 24).
- `npm run build`: bundle + type check pass (no errors).
- 2026-11-25: creator verified on macOS with `npm run start -- --web` (Bevy Web in Chrome): scene loads, 3x3 floor grid, HUD banner renders. Desktop Client not yet installed (`npm run start` without `--web` fails until it is).
- Note: the local preview showed a daytime sky; the night `worldConfiguration.skyboxConfig` may only apply in the deployed World. Revisit in M6 (SkyboxTime component if needed).

## M1 record

- Arena (static, 50 entities) is written into `assets/scene/main.composite` by `npm run arena` from `ARENA` in `src/config.ts` (composite-first rule; editable in Creator Hub). Playable radius 12 m, solid wall at 14 m, 8 pillars, 3 engraved rings, central dais, diagonal sector boundaries, 4 cardinal rune plates.
- Placeholder Watcher (code, `src/boss/watcher.ts`): robes, hood, ivory mask with slit + glowing eye, pale hands, three rotating bead rings (the Archive). Levitates, slowly turns to face the player, recoils + eye flare on hit. Hit volume is a config cylinder (r 1.6 m), independent of the meshes. Physics blocker stops walking into it.
- Imprint (`src/combat/imprint.ts`): global left-click polling, 1 s cooldown, third-person aim (camera ray → aim point → shot from caster at 1.3 m), 6° horizontal aim assist, swept segment-vs-cylinder hit test, 5 damage. Click on a free cursor captures it instead of casting; if the client never reports pointer lock, the second click casts anyway.
- Tracers: pooled (16) glowing beams that taper out over 0.3 s.
- HUD: boss name + 3-segment bar, Imprint readiness, crosshair (when locked), first-cast hint, debug line (last shot, hits, sector). **F refills boss HP (test key, remove later).**
- Session clock: one dt-accumulated clock (clamped at 0.1 s/frame), runs before all other systems.
- Tests: `npm test` (tsx + node:test) covers hit volume, range, caps, aim assist, sky shots, fixed-direction repeats, sectors with hysteresis.

## M2 record

- Every Imprint leaves an echo at the caster's floor position storing the shot's origin and direction (`src/echoes/echoLogic.ts`, pure + tested). Repeats fire the same direction every 4 s for 3 damage; they never home in.
- Placement: within 2 m of a friendly echo → refresh (direction, timer, recency); free slot → new; 4 slots full → replace oldest friendly (never corrupted); outside the engraved floor (r > 12 m) → no echo, feedback line.
- **Deviation (brief 7.2 allows it): forgiving synchronization.** A new or refreshed echo joins the formation's beat if its natural first repeat is within `ECHO.phaseSnap` (2 s) of it, never sooner than 2 s after placement. With 2 s the formation is always in phase, so the first echo repeats at exactly 4 s and later ones in 2–6 s. Set `phaseSnap` lower to make timing a skill again.
- Convergence (E): friendly echoes due within 1 s join; needs ≥2, otherwise a message and no cooldown. Participants fire at once (gold beams), share a new cycle, golden links drawn between them in order around the boss. One damage event: 2/3/4 hitting beams → 12/24/40 (replaces echo damage); sectors of hitting echoes recorded for later phase gates. 6 s cooldown.
- Visuals: translucent cyan spectral figure with a casting arm pointing along the remembered direction; floor rune fills over the cycle and turns gold in the ready window; flash on repeat. Crimson look reserved for corruption (M4).
- HUD: 4 echo slots (countdown, READY, "next" = replacement candidate when full), Convergence indicator (glows gold when valid, shows cooldown), feedback line, staged contextual hints.
- Watcher beads and hood changed from spheres to boxes/cylinders (M1 preview showed 56.6k triangles of the 90k budget).

## Watcher model integration (2026-11-25)

- Source: 4 Aholo GLBs (body, halo, mask, hand), 72 MB and 1.16 M triangles in total, 2048² PNG base + metallic-roughness each. Y-up, +Z front, origin at centre, metres. Halo copper-coloured, hand grey-green.
- Optimized copies (scripts/asset-pipeline, README there): body 10,984 / helm 1,999 / mask 2,498 / halo 1,500 / hand 2,000 tris; 1.33 MB in total; JPEG base colour (1024/512), metallic-roughness maps replaced by factors; crimson kept only on the eyes, with emissive eye maps. All pass `gltf-transform validate`.
- **Mask:** the body's built-in head is a dark helm, not an ivory mask. It is split off as `watcher_helm.glb` (cut at the collar, y = 1.59 model units) so it can be hidden; the Aholo ivory mask replaces it for the final transformation (`setVisage('mask')`), so only one is ever visible. Defeat can shatter whichever is shown.
- Assembly (`src/boss/watcher.ts`): scale 1.3 (about 5.2 m tall, hovering 0.45 m above the floor), helm in the body frame, 3 halo instances (1.5/2.15/2.8 m) behind the head rotating at 16/-10/6 °/s with breathing tilt, 2 spectral hands (left mirrored) drifting and gesturing out of phase, levitation, glide-turn toward the player with slight sway, hit recoil. About 21.5k triangles when visible.
- Missing or failed GLB → primitive placeholder (logged); still loading after 20 s → placeholder is shown meanwhile. **Preview key 1 toggles helm ↔ mask** (remove before release).
- Not yet verified in the client: emissive eye glow, metallic halo look under Decentraland lighting, negative-scale (mirrored) hand rendering, double-sided materials.
- Licensing: GLBs are gitignored until Aholo terms are confirmed; delivered to the creator directly.

## Scene budget (9 parcels)

90,000 triangles · 1,800 entities · 66 materials · 33 textures · World storage ~100 MB (organizer's wallet budget, not guaranteed) · 50 MB max per file.

## Open risks

- Input mapping for E / pointer in the real Explorer: M1 test (pointer) pending; E used from M2.
- Primitive cylinder/sphere default sizes assumed (cylinder height 1, diameter 1): unverified until seen in client.
- Per-visitor isolation in a shared World: needs a two-client test (M7).
- Asset licenses for Meshy / Aholo free tiers: creator to confirm.
- World storage quota is shared on the organizer's wallet; keep the scene small.

## Next step

Creator: playtest M2 (go/no-go): is placing echoes and firing a Convergence understandable and fun? Is E reliable? New triangle count? Then M3 (player HP, Gaze, Aftershock, victory/defeat/retry). Watcher GLB from Aholo can be integrated as soon as it arrives.
