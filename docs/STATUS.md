# Implementation status

Deadline: **30 Nov 2026 23:59 UTC** (1 Dec 05:29 IST). Deploy permissions on `rgl10.dcl.eth` are revoked after the deadline, and any later deploy means disqualification.
Target: working deploy by 29 Nov, final deploy with margin before the deadline.

## Milestones

| | Milestone | State |
| --- | --- | --- |
| M0 | Setup: SDK7 scaffold, skills, World config, build | **Done** (verified in local preview) |
| M1 | Greybox arena, placeholder Watcher, Imprint shot | Not started |
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

## Scene budget (9 parcels)

90,000 triangles · 1,800 entities · 66 materials · 33 textures · World storage ~100 MB (organizer's wallet budget, not guaranteed) · 50 MB max per file.

## Open risks

- Input mapping for E / pointer in the real Explorer: verify in M1.
- Per-visitor isolation in a shared World: needs a two-client test (M7).
- Asset licenses for Meshy / Aholo free tiers: creator to confirm.
- World storage quota is shared on the organizer's wallet; keep the scene small.

## Next step

M1: greybox arena, placeholder Watcher, Imprint shot. Creator to install the Desktop Client (https://dcl.gg/explorer) for control testing.
