# THE FINAL REHEARSAL
## Master game design, competition brief and implementation specification
Version 1.1 | 24 November 2026 | Working handoff for Claude Code

## 0. Instructions to Claude
You are the lead implementation engineer for an original Decentraland boss encounter. Treat this document as the source of truth. The creator and ChatGPT have already explored numerous concepts and selected The Final Rehearsal. Do not brainstorm replacement games, redesign the approved boss, introduce unrelated mechanics, or substitute a browser game. The target is a polished, fun, potentially prize-winning experience, not the maximum quantity of features. No placement is guaranteed.

Read this entire file, inspect the actual repository and installed SDK, consult the official references below, then report your understanding, platform risks, proposed project structure, and first implementation milestone. Work incrementally. If the repository is empty, scaffold an official SDK7 scene using the documented workflow. If it exists, preserve its configuration and work. Do not pretend to have assets, credentials, tools, or deployment permissions that are not present. Do not deploy, publish, purchase anything, or request credentials without the creator's approval. Never publish secrets or wallet addresses. Keep this brief in the repository and maintain a short implementation status file with completed features, test results, unresolved risks and next steps. Keep tunable parameters in a single configuration module. Explain any necessary deviations before making major design changes.

Legend: LOCKED means creative direction or core mechanic is approved; BASELINE means proposed numerical balance or implementation rule to validate; OPTIONAL means cut before compromising the core experience. Version 1.1 resolves ambiguities from earlier brainstorming: synchronization readiness, fixed spell trajectories, corruption reclaim, directional requirements and hard time cap. Those resolutions are proposed engineering defaults, not previously playtested decisions.

## 1. Competition and compliance
Official jam: GAME OVER 2026: The Final Boss Fight, hosted by Regenesis Labs.
Official page: https://itch.io/jam/game-over-2026
Build window: 24–30 November 2026. Deadline: 30 November 2026 23:59 UTC (1 December 2026 05:29 IST). Verify latest instructions on the official page, including linked Terms & Conditions and World deployment guidance.

The deliverable is one complete final-boss encounter, newly created during the jam, playable in a public Decentraland World. The full experience, including teaching controls and concluding the fight, must fit within five minutes. The objective must be obvious and the boss recognizable. Any genre and visual style are permitted. AI assistance and reuse of compatible, appropriately licensed code/assets are permitted, but the encounter itself must be new. Multiplayer, leaderboards and alternate endings are optional. Publish source in a public GitHub repository with an open-source license. Use either an owned World or organizer-assigned World; organizer assignments are subject to availability. Each participant can be associated with only one competing submission, regardless of account. Do not deploy changes after the deadline and before winners are announced unless RGL has granted prior written authorization. Keep the World public through judging. Do not rely on post-deadline patches.

Submission page needs title, short description, World name, instructions and controls, creator/team names, public GitHub link and applicable third-party credits. Wallet addresses are collected in a non-public submission field; never place them in public code or docs. Screenshots, cover and short trailer are recommended extras. Verify full terms before submission.

Seven equally weighted official judging categories (1–5 stars): boss identity/design; boss abilities and interactions; gameplay/controls; challenge and satisfying victory; originality; arena and audiovisual presentation; technical quality. These are a quality rubric, not a scoring prediction.

## 2. Product vision (LOCKED)
Title: THE FINAL REHEARSAL.
Tagline: Every spell leaves a trace. Every trace is being watched.
Boss: The Watcher — Keeper of Unforgotten Moments.
Arena: The Chamber of Unforgotten Moments.
Genre: Single-player magical action-strategy boss encounter inside a Decentraland World.
One-sentence mechanic: Every spell you cast leaves a spectral echo that repeats it, allowing you to choreograph multiple versions of your past into a synchronized attack.
Player fantasy: Begin as an inexperienced sorcerer; finish as the architect of a magical battle. Victory comes from understanding and orchestrating past actions rather than acquiring a larger weapon.
Emotional progression: curiosity → discovery → empowerment → interference → mastery → triumph.
Differentiator: continuous, repeating spell events in a single live arena, not mandatory death loops, full avatar replay or conventional summons. The player chooses where and when their history acts. The boss uses the same temporal magic and can turn a player's history against them. The final attack uses the actual arrangement of the player's echoes.

Non-goals: no full RPG, exploration campaign, inventory, mana economy, multiplayer combat, complex skill tree, long cinematic introduction, obligatory rhythm game, or external AI inference at runtime. No Unity, Godot, Unreal or Three.js game to port later. No copied Harry Potter names, spells, characters, assets, logos or music. The inspiration is original gothic magical-school atmosphere and forbidden temporal magic.

## 3. Judge-experience framework
Design and playtest for all 20 creator criteria:
1. Hook in ten seconds: cast immediately; first echo materializes and repeats quickly.
2. Aha within 30–60 seconds: discover the repeating spell and its tactical value.
3. Visible improvement: one echo → two coordinated echoes → a managed formation.
4. Depth: timing, space, interference and mastery, not merely faster attacks.
5. Trailer-worthy WOW: the player's own echo formation overloads the Watcher's defense.
6. Cleverness: discovery, spatial coordination and optional corruption redirection.
7. Fair failure: visible telegraphs, reachable safe areas, clear reason for damage.
8. Retry without reloading or replaying intro.
9. Desire to improve after winning: mastery grade and personal best.
10. Meaningful variation: placement, timings, attack sequence and optional techniques.
11. Minimal, responsive, predictable controls.
12. Memorable boss personality expressed through behavior and animation.
13. Character, mechanic, environment, sound and ending express the same idea.
14. Premium feedback: each meaningful action has a readable visual and sound response.
15. Sound communicates warnings, readiness, phase changes and success; visuals duplicate essential information.
16. Tight pacing with no long dialogue or forced waits.
17. One exceptional mechanic over ten mediocre mechanics.
18. Technical stability, collision reliability, bounded effects and clean restart.
19. Satisfying, gameplay-earned ending.
20. Recall tomorrow: player can describe the experience and boss in one sentence.

Priority: first-run enjoyment and successful completion > core mechanic depth > presentation polish > replay extras. Never trade core stability for a cosmetic feature.

## 4. Art direction (LOCKED)
Cinematic monochromatic gothic magical fantasy, evocative of ancient enchanted academies, forbidden chambers, Victorian stonework, silver moonlight and mysterious magical artifacts. Not generic neon sci-fi, bright cartoon fantasy, or gore-heavy horror. Main geometry and props in neutral grayscale; colors are reserved for gameplay.
Palette: obsidian #0B0B0B, charcoal #242424, stone #515151, silver #969696, ash #D4D4D4, ivory #F1EFEA. Friendly echo/spell cyan #85DFFF; synchronization/success antique gold #D8B76B; danger/corruption crimson #C5223F; final concentrated magic luminous white #FFFFFF. Use contrasting outlines and shapes in addition to color. Keep the playable floor sufficiently bright and legible. Avoid full-screen flashes, camera shake that obscures hazards, and excessive particles. Magical effects should be visually dominant precisely because the rest of the chamber is restrained.

Chamber: circular gothic hall, tall pointed arches, monochromatic stained-glass windows, floating candles, silver astronomical mechanism overhead, carved stone, subtly reflective-looking floor, ancient books, balconies, suspended mirrors and stone statues. Faint silhouettes in the walls represent previous sorcerers endlessly repeating their final spells. Keep them visually distinct from active echoes. The floor has concentric engraved circles and directional markings to support positioning. Architecture should never obstruct core gameplay. Use a neutral ambient light and emissive accents; verify actual SDK rendering capabilities rather than promising custom post-processing, real-time reflections or lighting unsupported by the client.

Environmental progression: initial stillness → cyan traces under echoes → golden links when synchronized → local crimson corruption cracks → levitating architectural fragments in final phase → released silhouettes and warm gold particles at victory. Use reusable scene entities and scripted transforms, not physics-heavy destruction.

## 5. The Watcher (LOCKED)
Backstory: An ancient sorcerer sought to preserve every moment. His forbidden magic trapped actions in endlessly repeating time fragments. Centuries of observing others erased his identity. He remembers everyone except himself. Every visitor becomes another subject in his archive. He underestimates the player, who learns to weaponize the moments he preserves. Lore should be conveyed visually and through brief dialogue, never a required exposition screen.

Appearance: approximately three player heights initially, adjusted for arena readability. Tall floating silhouette, layered black robes dissolving into shadow, elongated ivory porcelain mask with no mouth or nose, a narrow vertical slit containing an independently moving luminous eye. Three concentric silver engraved rings behind his head form The Archive, representing past, present and possible futures. Long pale hands with silver rings, casting through precise gestures rather than a conventional wand. Additional spectral hands appear later. Maintain the same iconic silhouette across phases.

Personality: patient, elegant, observant, quietly intimidating, initially curious, increasingly desperate as his supposedly perfect observation fails. No generic screaming demon. Idle levitation, slow independent halo rotation, eye tracking, subtle head tilts. Glides instead of walking. Teleport afterimages illustrate his temporal magic. When hit, he briefly appears as overlapping silhouettes. Later mask cracks, rings desynchronize, movements become abrupt. Final mask opens/breaks and rings expand; eyes appear across the chamber. Defeat shatters mask and rings.

Dialogue cues (short, non-blocking subtitles; voice optional):
- Opening: “Every moment leaves a trace.”
- First echo: “There you are. Again.”
- First synchronization: “You are learning things you were never meant to know.”
- Corruption: “Your past does not belong to you.”
- Final transformation: “I will not look away.”
- Defeat: “A moment I could not foresee...”
- Player defeat: “Another moment for my collection.”

## 6. Controls and onboarding
Desktop baseline: WASD native movement, mouse native camera/aim, left click Imprint, E Convergence, Space native jump. Verify actual SDK ActionButton mappings and conflicts in Explorer. Use supported fallback binding and update HUD if E is unavailable. No custom camera or native control override unless a documented feature is verified. No separate Aegis/shield spell in the MVP. Cursor/interaction mode must remain usable for Retry; do not intercept platform escape controls. Use a small crosshair or target cue only if supported.

Spawn within combat view and allow casting immediately. A short non-blocking prompt says “Cast a spell” with correct input icon. First cyan projectile and immediate ghost appearance; first repeat at four seconds. Show minimal “Your spell remembers” cue if necessary. After two echoes exist, introduce Convergence contextual prompt. Never block play with a tutorial panel. Keep controls and short objective accessible. Use aim assist only within a clearly defined target radius/cone; player should understand whether a shot will hit. The base prototype must prove reliable input and aiming in actual client.

## 7. Combat rules (BASELINE — tune via tests)
Core loop: cast → observe → reposition → coordinate → adapt. No mana. Player vitality 100. Boss health 300, three 100-HP phases. Player recovery +15 HP at each completed phase, capped at 100. Post-hit immunity 0.8s; damage feedback clear but unobtrusive. No damage during phase transition, victory or defeat. All gameplay damage and timing use one consistent simulation clock and state machine.

### 7.1 Imprint
Cast cooldown 1 second. Direct spell damage 5. Echo spell damage 3. Cast creates an echo at the actual cast position; store world position and original normalized direction/target point. First repeated shot occurs 4 seconds after creation, then every 4 seconds. Friendly echoes persist until replaced or reclaimed/destroyed by defined mechanics. Maximum four echo slots total, including at most one corrupted echo (not five). Minimum separation 2m; casting near an existing friendly echo refreshes its direction and timer rather than adding overlapping duplicates. A fifth placement replaces oldest friendly echo; if all legal replacement candidates are unavailable, give feedback and retain direct shot. Never silently delete a corrupted echo as a way to bypass its counterplay. Show oldest replacement candidate in UI. Echo models are stationary, translucent cyan, visually distinct from environment ghosts. No full avatar appearance cloning necessary; use a reusable spectral sorcerer.

Trajectory rule: a spell repeats the original spatial direction, not a homing shot that magically follows the boss; ordinary boss movement remains limited around center. Use a forgiving boss hit volume. Telegraph any displacement that changes useful aim. For MVP keep boss centered, use rotation and visual afterimages for teleport aesthetic. Casts used to interrupt/reclaim corruption do not spawn or refresh echoes; prioritize an explicit anchor hit over ordinary boss targeting. Avoid off-arena echo placement and explain invalid positions. Projectile simulation may use lightweight segment intersection / swept hit checks and visual beam effects to avoid tunneling; apply damage once per attack event.

### 7.2 Convergence
Two active spells only: Imprint and Convergence. Each echo's floor rune fills over its 4s repeat cycle. Readiness starts in the final 1s of that cycle. Natural synchronized casts occur as expected. To avoid permanently out-of-phase echoes, E may buffer eligible friendly echoes for up to 1s and pull the next due cast forward within a generous window; preview which echoes will join. For MVP implement deterministic ready-window grouping: when E is pressed, include friendly echoes whose next cast is due within 1s; require at least two. If fewer, no cooldown and show which echo is not ready. Player can align echoes by refreshing/casting close together at different positions; after successful Convergence participating echoes share a new cycle origin. If early playtests show this is too difficult with native movement, widen the window or introduce a forgiving initial two-echo synchronization; do not require frame-perfect inputs. Ordinary coincident casts must not accidentally consume the E cooldown. Six-second Convergence cooldown. E indicator glows when valid; no cooldown on invalid attempt. Golden links indicate participation. Sound forms a chord.

Damage: one ordinary echo hit 3; two-echo Convergence 12 total; three 24 total; four 40 total. These are aggregate replacement damage values, NOT extra damage on top of each echo shot. A synchronized group creates one registered damage event when its valid beams reach the boss. For phase requirements count only distinct friendly echo origins whose beams hit the target; require distinct angular sectors around the boss as specified below. Use four 90-degree sectors with a readable floor engraving. Boundaries should be forgiving (hysteresis or angle-based clustering) and clearly indicate participation; do not surprise the player. Convergence should feel like a coordinated attack, not a menu minigame. Keep visual/audio feedback synchronized with actual damage.

### 7.3 Corruption
Watcher targets one friendly echo (never more than one corrupted at a time). Crimson tether and glowing anchor, 2.5s warning. Hitting anchor interrupts the attempt without creating another echo. If not interrupted, the echo stops friendly repetition and charges a hostile shot aimed at the player's sampled position. Lock aim before firing, draw visible trajectory, allow dodge. Hostile shot damage 12, one hit per event. Reclaim by hitting the exposed anchor after corruption or by baiting the hostile trajectory through Watcher's hit volume; the latter damages the boss and restores the echo. Baseline redirect damage 15 (not allowed to bypass final phase barrier). Give a clear path back to friendly state even if player misses. If unresolved, hostile state auto-expires after 8s and restores friendly echo; avoid permanent slot lock. Reset restored echo timer. Corruption cannot target a new echo immediately after reclaim; initial 10s global interval, tune. Optional advanced technique: redirect hostile spell by placing yourself behind the boss relative to the echo and dodging after aim locks. Reward it, never require it for basic completion.

### 7.4 Boss attacks
All telegraphs require distinct shape, sound and duration. Track player briefly, lock before damaging; no unavoidable tracking. Scheduler allows recovery and avoids incompatible hazards. Starting intervals and widths are tuning values.
- The Gaze: crimson cone, ~45 degrees, 1.2s warning including final 0.6s locked aim, brief damage window, 15 damage. Watcher's eye and head turn, rising whisper then crack. Teach sidestep.
- Aftershock: low expanding annular wave, 1.5s warning, 10 damage per wave. Repeat once four seconds later, with visible advance warning and bell. Jump above the wave if actual vertical tracking is reliable; otherwise introduce clear safe gaps as fallback. No invisible or unavoidable ring damage. Check height/radius and mark hit per wave. Teaches boss echoes.
- Stolen Moment: corruption as specified above. Distinct tether and anchor, reversed metallic chime. Teach managing the formation.
- The Blind Spot: 2s warning, one safe ~90-degree sector clearly indicated on floor, 5s vulnerability period. Other sectors threatened by a single 15-damage pulse after warning; do not continuously damage trapped players. Select sector only if reachable under actual movement speed or extend warning. Ordinary shots from safe sector can damage boss during phase II. Direction indicated by halo eyes and clear wedge. Avoid combining with a contradictory ring/cone.
- Final Observation: phase III barrier deflects ordinary shots, opens predictable 5s windows after a visibly telegraphed 20-damage pulse with reachable safe regions. During opening, coordinated multi-direction hits overload rings. This is the ultimate test, not a new control system. Start with 10–12s cycle; tune exposure duration based on novice tests. Use the same visual vocabulary from earlier phases.

## 8. Encounter state and phase progression
States: READY, ACTIVE_PHASE_1, TRANSITION_1, ACTIVE_PHASE_2, TRANSITION_2, ACTIVE_PHASE_3, VICTORY, DEFEAT, RESETTING. Substates for boss telegraph, execution and recovery. Keep one session clock; no restarting it at phase transitions. A run starts when player receives control; combat hard cap 285s including onboarding and transitions. End sequence max 10s; result screen reachable by 295s. On timeout, show clear defeat and retry. A single playthrough must be completable within 300s; do not force the player to wait for phase timestamps. Stop attack systems on terminal states. Preserve player formation across phase transitions; pause timers briefly and resume safely.

Phase I — The Observer (target 0:00–1:10): calm floating boss, intact mask, slow rings. Gaze and Aftershock introduced sequentially, not both at spawn. Ordinary spells and echoes damage boss. At 200 HP clamp damage, raise barrier, teach two-echo Convergence. Successful two-echo hit breaks gate and triggers phase II; gate-opening damage does not carry over. Provide contextual hint if no progress after ~8s. First phase should not be a long HP grind.

Phase II — The Interference (target 1:10–3:00): crack mask, extra hands, unstable rings. Add Stolen Moment and Blind Spot. Ordinary damage reduced to 25% outside vulnerability windows, full during Blind Spot. Convergence normal damage when valid. At 100 HP clamp, raise gate requiring three friendly echoes in distinct sectors (at least two sectors for this intermediate gate if novice tests warrant). Successful gate-opening hit triggers phase III without carryover. Heal player +15 each transition. Add explicit readiness/sector cue if stalled. Do not reset echoes unnecessarily.

Phase III — The All-Seeing (target 3:00–4:35): opened mask, expanded halos, eyes on walls, floating fragments, distorted voice. Ordinary direct/echo hits deflected. During Final Observation opening, require at least three friendly synchronized hits from three distinct sectors to damage boss (24 damage); four sectors/echoes produce 40 damage. Only qualifying Convergence can reach zero and trigger ending. Keep corruption optional to redirect, but do not allow it to bypass gate. Use short predictable vulnerability cycles and ensure enough opportunities for novices. No simultaneous lethal hazards during a required timing window. At zero, end immediately in gameplay-driven climax. A three-echo qualifying final formation is fully valid; cinematic adapts to actual participating echoes, never fake a fourth beam. Perfect four-direction version gets stronger presentation/score.

Pacing targets: 0–10s hook; 10–60s discovery; 60–120s basic mastery; 120–210s interference/escalation; 210–275s final challenge; final 10–15s conclusion. These are targets, not scripts forcing waits. If playtests show phases end too fast or slow, tune HP/damage/attack cadence and gates, not artificial waiting.

## 9. Victory, defeat and retry
Victory sequence (~10s): participating echoes turn gold and face boss; beams converge from actual positions; silver rings stop; music cuts, brief apparent temporal freeze achieved through scene animation; single heartbeat; mask and halo fragment; wall silhouettes released; gold motes fill chamber; clock moves forward. Watcher whispers final line. Title and “Time moves forward again.” Results shown. No excessive screen flash or forced camera behavior. This is a consequence of gameplay, not a separate QTE. Keep player safely in scene and disable damage during sequence.
Defeat: vitality zero or time expires. Silver seal/brief fade, “A MOMENT LOST”, reason (health/time), reached phase, best convergence, time survived, short actionable tip. “REWRITE THE MOMENT” button. On Retry reset HP, state, boss model, all timers, cooldowns, shots, effects, echoes, UI, audio and score. No reload; target <2s once scene loaded. Use session identifier or cancellation mechanism to prevent stale callbacks. Victory Retry label “REHEARSE AGAIN”.

## 10. UI, score and replay
Minimal silver typography, dark translucent panels, high contrast. Boss name + segmented phase health bar; player vitality; elapsed/remaining time; four echo slots with readiness and corruption/oldest status; E readiness/cooldown; short contextual objective; telegraph shapes on floor. Avoid clutter. Keep HUD within safe screen margins and ensure retry clickable. No real-money or blockchain mechanics.

Local mastery score (optional after stable core), maximum 10,000:
- speed = 3000 * clamp((285 - completionSeconds)/165, 0, 1)
- vitality = remainingHP * 30
- perfect = min(4, numberOfValidFourEchoConvergences) * 750
- redirect = min(2, successfulCorruptionRedirects) * 500
- total = round(sum); S >=8500, A >=7000, B >=5000, else C. Count only successful combat events, prevent score farming; revise score after tests if optional redirects or timing make S unreasonable. Do not require account persistence; session personal best if feasible.
Achievements (optional): Prodigy (<3min), Untouchable (zero damage taken, not just full final HP), Perfect Harmony (four-echo convergence), The Unseen (valid blind-spot hit), Usurper (redirected corrupted spell), Master of Moments (S rank). Seeded or curated variation in safe attack sequences, blind-spot directions and corruption targets. Replay should differ through placement and choices, not unfair randomness. No external leaderboard required.

## 11. Sound design
Original or licensed soundtrack: sparse gothic ambience, clock ticks, distant choir, subtle strings. Gaze rising whisper then crack; Aftershock deep bell with delayed repeat; corruption reversed metallic chime; Blind Spot directional warning plus visible wedge; echo readiness soft high note; two/three/four-way convergence increasingly rich compatible chords; final transformation distorted choir and clock; victory heartbeat, silence, shatter and harmonic resolution. Use pre-rendered compatible audio cues rather than complex real-time music generation. Keep overlap bounded and volume mixed. All important cues also visual. Voiceover optional; subtitles sufficient. Do not use the Harry Potter soundtrack or imitation of an identifiable actor's voice.

## 12. Technical architecture and platform constraints
Primary tools: Claude Code, TypeScript, Decentraland SDK7, Creator Hub/Explorer, Git/GitHub. Creator uses macOS and has prior npm/GLB experience. Meshy and Aholo for individual assets; Blender optional for cleanup. Use stable installed SDK7, inspect package.json and installed typings. Do not invent APIs, assume DOM/Three.js/WebGL availability, use browser canvas, or attempt to manipulate native HUD/controls unsupported by SDK. Verify camera/position/input, ECS transforms, pointer/raycast, UI, audio, animation and deployment APIs against current official docs and skills. Prefer Creator Hub MCP for scene editing when available and configured; otherwise use supported code workflow. Do not assume MCP exists.

Suggested code responsibilities (adapt to scaffold): src/main.ts entry; config.ts for tuning; game/session.ts state machine; player/input.ts; combat/spells.ts and collision.ts; echoes/echoSystem.ts; boss/bossController.ts and attackScheduler.ts; effects/pool.ts; audio/audio.ts; ui/hud.ts and results.ts; scene/arena.ts; testable pure math helpers. Keep runtime systems small and modular; no unnecessary framework. Use dt-based updates or absolute session time consistently; clamp large dt safely; clear queued events on reset. Prefer pooled projectiles/telegraphs/particles and reusable entities. Geometry and damage state should be decoupled from visual model availability. Missing asset → intentional placeholder + clear log, never game crash. No external network dependency needed for gameplay.

Multi-visitor behavior is a required integration test, not a new multiplayer feature. Design per-player local encounter state where supported by SDK; verify whether local scene entities and interactions actually isolate visitors in deployed World. Other avatars must not trigger or corrupt a player's fight. If unavoidable, implement a documented supported one-player-at-a-time mechanism or safe isolated arena and communicate it clearly. Never claim isolation without two-client testing.

Arena sizing: inspect assigned World and parcel limits before final dimensions. Target an unobstructed circular playable floor sized to actual movement speed and sector reachability. If only one 16m parcel, design a compact chamber (e.g. ~6m playable radius with border margin), then retune minimum echo separation/telegraphs as necessary. Larger allocation permits more visual scale. Use simple collision geometry and consistent coordinate conventions. Keep every gameplay entity inside allowed bounds. Do not assume floor/wall collisions from generated GLB. Test jumping, clipping, exits and camera occlusion. Verify scene budgets for triangles, textures, materials, entities, audio, file sizes and parcel boundaries with current documentation/optimizer. No guaranteed performance from AI-generated assets.

## 13. Asset production and manifest
Creator generates assets using Meshy AI (limited free credits) and Aholo/Lux3D (limited generations). Only use accounts and credits in compliance with provider terms. Check free-tier export/publication/redistribution rights before using assets in an open-source jam. Track source, author, license, generation date, attribution and redistribution status for every file. Open-source code license does not automatically license all third-party assets. Ensure required project files can be shared lawfully, or choose alternative assets. Do not generate expensive assets before dimensions and compatibility are confirmed.

Hero assets, priority order:
1. The Watcher body: black floating layered robes, slender elongated gothic sorcerer, neutral pose with separate or editable hands/mask if possible. No background, no ground pedestal, no weapons or colorful effects baked into texture. One recognizable model, not three unrelated characters. Rigged model optional; levitation, root movement and modular components are sufficient.
2. Ivory mask: elongated mouthless face, narrow vertical eye slit; separate mesh for animation and fracture. Independent luminous eye geometry. Intact and cracked variants or reusable fracture pieces.
3. Archive halo: ornate silver ring with etched eye motifs; reuse three scaled rings independently rotating. Separate ring entities, no baked central character.
4. Spectral echo: lightweight hooded sorcerer silhouette, reusable for all slots; cyan emissive/translucency if supported, simple cast pose. Crimson corruption variant via material/model swap. No need for exact player avatar cloning.
5. Separate pale hands/extra spectral hands, optional wand only if attachment supported.
6. Gothic chamber kit (Aholo): pointed arch, pillar, window, balcony section, floor trim, carved wall segment. Use modular repeating structures, not one unverified enormous model. A whole-room generation may be a reference or optional shell only if optimized and collisions validated.
7. Decorative floating candle, book, statue, mirror, clock mechanism, stone fragments. Reuse models; reduce details far from player.

Procedurally create through supported SDK: arena geometry and runes, spell tracers, beam meshes, warning cones/wedges/rings, timer runes, golden links, crimson tethers, anchors, boss eye glow, afterimage silhouettes, fragment motion and victory particles. No costly AI generation for elementary effects. Target GLB/glTF, clean origin, normalized scale, modest material count, 512–1024 textures where sensible, optimized geometry. Validate actual limits. Do not promise unsupported transparency or shader effects; use tested alternatives.

Suggested paths: assets/boss/watcher_body.glb, watcher_mask.glb, watcher_mask_cracked.glb, archive_ring.glb, watcher_hand.glb; assets/echoes/echo.glb; assets/environment/arch.glb, pillar.glb, window.glb, wall.glb, balcony.glb, clock.glb; assets/props/candle.glb, book.glb, mirror.glb, statue.glb; assets/audio/ for licensed tracks and cues; assets/textures/ for runes. Use manifest mapping rather than hardcoded missing paths. Ask creator for required asset once gameplay scale is known.

## 14. Implementation milestones (sequential, test each)
M0: inspect environment, install official SDK skills, create/verify SDK7 scaffold, confirm local preview, Git init if needed, verify World access/parcel constraints. Record exact commands and versions. Do not install unrelated engine.
M1: greybox circular arena, stationary floating placeholder Watcher, native movement/aim and Imprint shot. Test hit volume, cooldown and boundaries.
M2: echo placement, exact repeated trajectories, four-slot replacement, runes, deterministic timing, Convergence damage, feedback. Test one-to-four echoes, near placement, invalid E, cooldown, missed beam, sector counting. This is the go/no-go milestone: must be fun even with primitive geometry. If synchronization is frustrating, simplify readiness before moving on.
M3: player HP, Gaze, Aftershock, telegraphs, scheduler and clean hit logic. Implement a small complete victory/defeat/retry loop first. Test damage immunity and no impossible patterns.
M4: corruption, interruption/reclaim, optional redirect, Blind Spot, phase gates and final barrier; hard timeout, transition pause, heal and retry. Complete all phases in greybox. If deadline pressure, simplify attacks IV/V visuals and use shared hazard primitives; retain final multi-direction mechanic.
M5: integrate actual Watcher and chamber modular assets. Verify dimensions, draw calls/budgets, collisions. Add root levitation, rings, eye tracking, hand gestures, crack variants, afterimages. No skeletal animation dependency if unavailable.
M6: polish readable visual telegraphs, spell feedback, HUD, soundtrack/SFX, subtitles, final gameplay-driven cinematic. Add results and replay grade only after core works. Optional decorative props last.
M7: blind playtests, adjust parameters, verify max duration, restart, performance, simultaneous visitors, missing assets and clean build. Check licensing. Freeze final version, deploy with creator approval, test public World, record version/commit, prepare submission materials. No post-deadline deployment.

Planning target, not guarantee: day 1 setup + echo prototype; day 2 complete boss loop; day 3 art and effects; day 4 sound, playtest and deployment buffer. Adapt to actual remaining jam time; finish one compliant entry before any other prototype. No additional game is in scope for this repository.

## 15. Acceptance tests and release gates
Functional: build/typecheck succeeds; all controls work in real Explorer; first echo appears immediately and repeats after 4s; direct and echo damage applied exactly once; 4-slot cap; no replacement corruption exploit; synchronized 2/3/4 hit totals correct; invalid E never consumes cooldown; directional rules readable; phase HP gates cannot be bypassed; corruption always reclaimable; telegraphs correspond to hit volumes; safe zone reachable; no attacks in transition/results; hard timeout + end sequence <300s; restart clears all timers/entities/state; ten consecutive retries without stale events; leaving/re-entering scene safe; at least two visitors tested; no missing assets or severe clipping; no secrets in Git; source license and credits present.

Judge tests: recruit ideally five new players, no coaching. Observe time to first cast (target <10s), understanding echo repeat (<30s), first successful synchronization (<60s), reason for each death, completion time, ease of retry, subjective fun and most memorable moment. Ask whether they want to replay before suggesting it. Ask them to explain mechanic in one sentence. Second attempt should show better strategy. Aim for most novice testers able to complete within 5 min with contextual cues, not merely developer speedrun. Measure actual FPS/stutter and client behavior on available hardware; do not invent test results. A failed test is a task to fix, not a score to conceal.

Critical risks: rigid 1s timing may be too hard; four echoes may trivialize early HP; fixed trajectory may miss after visual relocation; narrow sectors may be unreachable; excessive FX and large GLBs may hurt FPS; platform controls and UI focus may conflict; per-player isolation uncertain. Prototype these early. Cut optional achievements, extra voice lines, fancy debris, leaderboard, precise avatar cloning and cinematic extras before cutting central combat. Use only documented API workarounds. Record actual limitations and alternatives.

## 16. Official links and working resources
Competition: https://itch.io/jam/game-over-2026 (includes official terms, World requests/support, judging rubric and submission rules).
Official SDK skills: https://github.com/decentraland/sdk-skills
Install from project root if not already present: `npx skills add decentraland/sdk-skills` (inspect prompts and installed files; avoid duplicate/conflicting setup).
Decentraland creator docs source: https://github.com/decentraland/docs/tree/main/creator
Creator Hub: https://github.com/decentraland/creator-hub
AI-assisted workflow: https://github.com/decentraland/docs/blob/main/creator/sdk7/getting-started/vibe-coding.md
CLI setup/preview/deployment: https://github.com/decentraland/docs/blob/main/creator/sdk7/getting-started/using-the-cli.md
Coding essentials: https://docs.decentraland.org/creator/scenes-sdk7/getting-started/coding-scenes
Development workflow: https://docs.decentraland.org/creator/scenes-sdk7/getting-started/dev-workflow
SDK examples: https://github.com/decentraland/sdk7-test-scenes
Scene optimizer: https://github.com/decentraland/SceneOptimizer
Creator Hub / Explorer downloads: https://decentraland.org/
GitHub: https://github.com/
Open-source license selection: https://choosealicense.com/
Meshy: https://www.meshy.ai/
Aholo: https://aholo.ai/ (creator's asset-generation workflow; verify export and terms in the actual service)
Blender: https://www.blender.org/
Use official docs matching installed version. Typical preview `npm run start`, deployment `npm run deploy` only after explicit creator approval and correct World configuration. Check package scripts rather than assuming commands exist.

## 17. First response expected from Claude
1. Confirm understanding of the game in one sentence and summarize locked mechanics and style.
2. Inspect project/environment if access exists; state what is installed and what is missing, without claiming unverified access.
3. Identify concrete SDK risks for inputs, raycasts, timing, collision, UI, per-player state, models and World constraints; cite official docs/skills where possible.
4. Propose the smallest correct implementation of M0–M2, with files and acceptance tests.
5. If using Claude Code with repository access, proceed with M0 safely and show actual build/preview status. If using chat-only Claude, provide precise setup commands and request outputs rather than claiming execution.
6. Keep all later milestones in the plan but do not attempt full art production or deployment in the first implementation step.

END OF MASTER BRIEF
