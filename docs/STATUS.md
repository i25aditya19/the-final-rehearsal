# Implementation status

Deadline: **30 Nov 2026 23:59 UTC** (1 Dec 05:29 IST). Deploy permissions on `rgl10.dcl.eth` are revoked after the deadline, and any later deploy means disqualification.
Target: working deploy by 29 Nov, final deploy with margin before the deadline.

## Milestones

| | Milestone | State |
| --- | --- | --- |
| M0 | Setup: SDK7 scaffold, skills, World config, build | **Done** (verified in local preview) |
| M1 | Greybox arena, placeholder Watcher, Imprint shot | **Built, build + 13 unit tests pass; in-client test by creator pending** |
| M2 | Echoes, repeat timing, Convergence (go/no-go) | Not started |
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

## Scene budget (9 parcels)

90,000 triangles · 1,800 entities · 66 materials · 33 textures · World storage ~100 MB (organizer's wallet budget, not guaranteed) · 50 MB max per file.

## Open risks

- Input mapping for E / pointer in the real Explorer: M1 test (pointer) pending; E used from M2.
- Primitive cylinder/sphere default sizes assumed (cylinder height 1, diameter 1): unverified until seen in client.
- Per-visitor isolation in a shared World: needs a two-client test (M7).
- Asset licenses for Meshy / Aholo free tiers: creator to confirm.
- World storage quota is shared on the organizer's wallet; keep the scene small.

## Next step

Creator: pull and test M1 (aiming feel, hit reliability, crosshair, controls in browser and Desktop Client). Then M2: echoes + Convergence.
