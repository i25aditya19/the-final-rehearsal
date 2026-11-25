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
| M4 | Corruption, Blind Spot, phase gates, final barrier, timeout | **Built, build + 42 unit tests pass; creator playtest pending** |
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
- Licensing: creator confirmed Aholo terms allow publishing; GLBs committed 2026-11-25.

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
- Watcher models committed to `assets/boss/` after the creator confirmed Aholo's terms allow publishing on GitHub (2026-11-25).
- Unverified in client: lighting intensity, particle look/budget behaviour, beam orientation (cylinder axis fix), dusk readability.

## M4 record

- **Phase rules** (`src/game/phaseRules.ts`, pure + tested): floors 200/100/0; phase I full damage; gate I = Convergence with 2 hitting echoes; phase II ordinary spells ×0.25 except during Blind Spot vulnerability, Convergence full; gate II = 3 hitting echoes from 3 quadrants (`PHASES.phase2GateSectors`); phase III barrier admits only a Convergence of 3+ echoes from 3+ quadrants during a Final Observation opening (24 / 40 damage); redirects never pierce it. Gate-opening hits do not carry damage. All boss damage goes through `hitBoss()` (`src/game/phases.ts`).
- Transitions: 3 s, no attacks and no damage, echo beat paused and resumed, +15 vitality; phase III swaps the helm for the ivory mask and says "I will not look away." Barrier shell: ash at gates, white shield in phase III, gold when open; deflections spark.
- **Stolen Moment** (`src/boss/corruption.ts`): targets the friendly echo nearest the player; crimson thread from the Watcher's eye to a pulsing anchor; shoot the anchor in 2.5 s to protect it (that cast leaves no echo). Otherwise the echo turns crimson (cyan model hidden) and fires hostile shots: aim follows you 1 s, locks 0.7 s (thicker line), fires (12 damage if within 1.1 m of the path). If the Watcher is between the echo and the locked point, the shot is **redirected** into him (15 damage, echo restored, counted for score). Anchor stays shootable to reclaim; auto-expires after 8 s; 10 s cooldown; never deletes the echo.
- **Blind Spot** (phase II): four floor quadrants; the pale one is the neighbour quadrant whose border you are closest to; 3 s warning (BASELINE 2 s, lengthened for the 20 m floor), single 15-damage pulse outside it, then 5 s of full damage.
- **Final Observation** (phase III): crimson floor with four pale safe circles (r 3.2 m at the N/E/S/W runes), 2.2 s warning, 20-damage pulse outside them, then the barrier opens for 5.5 s, then 3.5 s rest.
- Scheduler per phase: I = Gaze, Gaze, Aftershock; II = Stolen Moment, Gaze, Blind Spot, Aftershock, Gaze, Blind Spot; III = Observation, Observation, Stolen Moment, Observation, Gaze. At gates only Gaze/Aftershock run, with longer recovery. Nothing runs during transitions.
- Score (brief §10): speed + vitality + 4-way Convergences + redirects, grade S/A/B/C, session personal best; shown on victory.
- HUD: phase name and BARRIER state in the boss bar, always-visible objective line, stuck-at-gate hints after 8 s, specific "why was this blocked" messages.
- Echo ghosts now use the Aholo spectral sorcerer model; the primitive figure is a state aura (gold when ready, flash when firing, solid crimson when corrupted).

## Chamber of Unforgotten Moments (2026-11-25)

- 7 new Aholo models audited (`tex_mesh_4` was uploaded twice, identical): spectral echo, astronomical rings, door, arch, window, pillar, candle, clock; 278k-532k triangles each, 2048² PNG textures, Y-up, +Z front, centred origins, metres; door/window/clock had bronze-brown tones. Optimized with the same pipeline (UV-aware permissive decimation, about 1 % error), recoloured to stone/silver/ivory (echo cyan), all pass glTF validation. A grey translucent `wall_silhouette` variant of the echo model represents past sorcerers.
- Layout (static, in `main.composite` via `npm run arena`): 12 Aholo pillars (13 m) + 12 arches (13.5 m) on a 24.8 m ring, 7 stained-glass windows behind the arches, 4 silhouettes in the other archways, the grand door at the south entrance behind the spawn, 16 m outer wall with cornice, astronomical clock (8.4 m) high on the north wall, floor engravings (48 ticks, 12 star marks). Pillar collision = invisible cylinders; arches, windows, door, clock have no colliders. The 20 m combat floor has no obstacles.
- Animated (`src/scene/chamber.ts`): two astronomical ring mechanisms overhead (19 m and 11 m, counter-rotating), 24 floating candles bobbing with flickering flames.
- **Budget check**: model triangles 143.6k (limit 250k for 25 parcels), about 300 composite entities, assets 4 MB (World budget about 100 MB). Checked with `scripts/asset-pipeline/chamber_render.py` section renders, not in the client yet.

## Enclosed chamber and lighting pass (2026-11-25)

- **Enclosure** (procedural, original, `scripts/asset-pipeline/build_chamber_shell.py`): continuous ashlar wall (r 28.2 m, 0-19 m), pointed ribbed vault to 35 m with a silver star-map/constellation texture, 12 ribs above the 12 pillars, pilasters from the gallery to the springing ring, silver springing and oculus rings, and a **gallery ledge** resting on the pillar/arch tops and joining them to the wall. No sky, clouds or outside scenery visible. Old box outer wall, cornice and stacked floor discs removed.
- **Floor**: procedural astronomical marble disc (r 23.4 m): mid-grey veined marble, darker polished border, zodiac ring with 12 houses and original glyphs, eight-pointed star, dais; the gameplay rings (0.75 R, 0.5 R, playable edge) are inlaid in the texture. Sector lines and N/E/S/W rune plates remain as glowing overlays. **The creator's "astronomical ritual marble texture" was never received**; drop it in and it can replace this one.
- **Clock** moved to the centre, hanging on a silver chain beneath the apex at 25.5 m, turning slowly, inside the two counter-rotating astronomical rings.
- **Materials** (`scripts/asset-pipeline/retone.sh`): each model's tones remapped (2-98 % luminance onto a target range): pillars ash-grey 0.42-0.86, arches 0.38-0.80, door 0.22-0.66, windows 0.34-0.92 with **luminous ivory glass** (emissive from bright glass), clock/rings/halos antique silver 0.40-0.95 with metallic reduced to 0.12-0.15 (metallic surfaces rendered dark without reflections), candles ivory with a soft glow, Watcher robes lifted to show folds (still black). Normals checked: consistent with winding on all models (92-100 %), none flipped.
- **Lighting**: sky hidden, so a neutral 13:30 sun; the vault and wall have `castShadows: false` (GltfNodeModifiers) so the enclosure does not black out the arena; 5 silver point lights at 11 m, a white key spotlight on the Watcher from above, the crimson under-light (7 lights, mobile budget 8).
- Gameplay code untouched (42 tests pass).
- Budget: about 153k model triangles (limit 250k), assets 6 MB.

## Scene budget (25 parcels)

250,000 triangles · 5,000 entities · 94 materials · 47 textures · World storage ~100 MB (organizer's wallet budget, not guaranteed) · 50 MB max per file.

## Open risks

- Input mapping for E / pointer in the real Explorer: M1 test (pointer) pending; E used from M2.
- Primitive cylinder/sphere default sizes assumed (cylinder height 1, diameter 1): unverified until seen in client.
- Per-visitor isolation in a shared World: needs a two-client test (M7).
- Asset licenses for Meshy / Aholo free tiers: creator to confirm.
- World storage quota is shared on the organizer's wallet; keep the scene small.

## Next step

Creator: full playtest in Chrome and the Desktop Client (whole fight, all phases, corruption, Blind Spot, Final Observation, retry), screenshots of the chamber, FPS and triangle stats. Next: M5/M6 polish: sound and music, mask/halo shattering victory cinematic, phase-transformation effects, attack anticipation animation, tuning from playtest results.
