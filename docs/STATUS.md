# Implementation status

Deadline: **30 Nov 2026 23:59 UTC** (1 Dec 05:29 IST). Deploy permissions on `rgl10.dcl.eth` are revoked after the deadline, and any later deploy means disqualification.
Target: working deploy by 29 Nov, final deploy with margin before the deadline.

## Milestones

| | Milestone | State |
| --- | --- | --- |
| M0 | Setup: SDK7 scaffold, skills, World config, build | **Done** (verified in local preview) |
| M1 | Greybox arena, placeholder Watcher, Imprint shot | **Done**: creator verified in Chrome 2026-11-25 (6/7 hits, HP bar, sectors, ~30 FPS) |
| M2 | Echoes, repeat timing, Convergence (go/no-go) | **Built, build + 25 unit tests pass; creator playtest pending (go/no-go)** |
| M3 | Player HP, Gaze, Aftershock, victory/defeat/retry | **Built, build + 32 unit tests pass; creator playtest pending** |
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

## M3 record

- Session state machine (`src/game/session.ts`): active → victory (boss 0 HP) / defeat (vitality 0 or 285 s hard cap). Systems stop on terminal states; the cursor is released for the results button. **Retry without reload**: `resetState()` plus per-system reset hooks (attacks, tracers, Watcher look); clock restarts at 0, `runId` increments; first 0.4 s after retry ignores clicks/E so the retry press cannot cast.
- Player vitality 100, 0.8 s post-hit immunity, one damage per attack event, crimson screen-edge flash (no full-screen flash), damage source recorded for the defeat screen.
- **The Gaze**: crimson floor fan from the dais toward the player; tracks smoothly for 0.6 s, locks for 0.75 s (brighter), fires 15 damage if inside, 0.25 s flash. **Deviation from BASELINE**: 38° wide and 1.35 s warning (brief: ~45°, 1.2 s, 0.6 s locked) so the sidestep is reachable at the arena edge. Tunable in `ATTACKS.gaze`.
- **Aftershock**: two crimson ring waves (second 4 s after the first, each with its own 1.5 s pulsing warning at the dais) expanding at 7.5 m/s; 10 damage per wave, once per wave; swept hit test. Avoid by jumping (feet > 0.45 m when it passes; **unverified in client**) or by standing in one of two 50° gaps marked with pale floor lanes, placed next to the player when the warning appears so they are reachable.
- Scheduler: first attack at 12 s (onboarding grace), sequence Gaze, Gaze, Aftershock, repeating, 4.5 s recovery between attacks, never two at once.
- Dialogue subtitles (non-blocking, once per run): opening, first echo repeat, first successful Convergence, victory, defeat.
- HUD: vitality + remaining time panel, attack name label during telegraphs, results screen (title, reason, time, best Convergence, vitality lost, spells cast, tip, REHEARSE AGAIN / REWRITE THE MOMENT button, or E).
- Victory placeholder: halos freeze, Watcher sinks; full gameplay-driven cinematic is M6.
- Phases, gates, corruption, Blind Spot, Final Observation: M4. No audio yet (M6).

## Feedback round 1 (2026-11-25): bigger arena, real projectiles, eye beam

- **Arena 5x5 parcels (80x80 m)**: playable radius 20 m (was 12), wall at 23 m (48 segments, 3 m high, silver coping), 12 pillars 14 m tall with bases, capitals and candles, dais 4.5 m. Spawn moved south (z 22-24). Scene limits now 250k tris / 5,000 entities.
- Watcher scaled to 1.65 (about 6.6 m), hit volume r 2.1 m x 7.2 m; halos 1.9/2.7/3.5 m; hands 2.0 scale.
- **Spells are flying projectiles** (34 m/s): white-hot core, coloured halo, tapered streak, particle trail; damage applied on arrival with an impact burst. Misses stop at the wall or floor with a small fizzle (`stopDistance`, tested). Echo repeats use the same projectiles, slightly smaller.
- **Convergence**: round gold beams (cylinders) with gold impact bursts; golden floor links.
- **The Gaze is now a beam from the Watcher's eye**: thin shimmering crimson aiming ray while tracking, brighter when locked, then a thick blast that sweeps across the whole cone with crimson sparks where it meets the floor. The floor fan stays as the readable warning. Range 24 m, 34° wide, 1.5 s warning (0.8 s locked).
- Aftershock: 64 segments, scaled for the larger floor (starts at 4.6 m, 10 m/s).
- Particles (exactly 8 emitters, max 710 particles): 4 spell trails, 1 impact, 1 Gaze sparks, 1 Watcher shadow aura, 1 ambient silver motes. Soft round sprites `assets/images/glow.png`, `spark.png` (no square particles).
- Atmosphere: fixed dusk (19:30) via scene.json and runtime SkyboxTime; 4 silver point lights + 1 crimson under-light (5 of 8 mobile budget).
- Echo ghosts: sphere hood and round casting arm.
- **Watcher models still not in git**: committing them needs the creator's explicit confirmation that Aholo's terms allow public redistribution (the repo is public). Until then they must be unzipped locally into `assets/boss/`.
- Unverified in client: lighting intensity, particle look/budget behaviour, beam orientation (cylinder axis fix), dusk readability.

## Scene budget (25 parcels)

250,000 triangles · 5,000 entities · 94 materials · 47 textures · World storage ~100 MB (organizer's wallet budget, not guaranteed) · 50 MB max per file.

## Open risks

- Input mapping for E / pointer in the real Explorer: M1 test (pointer) pending; E used from M2.
- Primitive cylinder/sphere default sizes assumed (cylinder height 1, diameter 1): unverified until seen in client.
- Per-visitor isolation in a shared World: needs a two-client test (M7).
- Asset licenses for Meshy / Aholo free tiers: creator to confirm.
- World storage quota is shared on the organizer's wallet; keep the scene small.

## Next step

Creator: playtest M2+M3 together (echo/Convergence feel, Gaze sidestep, Aftershock jump vs gaps, retry), plus the Watcher model look and triangle count. Confirm Aholo redistribution terms so the models can be committed. Then M4: phases, gates, corruption, Blind Spot, Final Observation.
