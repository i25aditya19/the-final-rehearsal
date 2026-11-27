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

On 2026-11-25 the creator confirmed that Aholo's terms and conditions allow publishing these models on GitHub. They are optimized derivatives of the creator's Aholo generations (see scripts/asset-pipeline). The repository's MIT license covers the code; the models remain subject to Aholo's terms. The game falls back to a primitive Watcher if they are absent. Arena shell, props and effects are procedural (listed below).

| assets/environment/chamber_floor.glb, chamber_wall.glb, chamber_vault.glb, chamber_parapet.glb | generated procedurally for this project (scripts/asset-pipeline/build_chamber_shell.py) | project | MIT (with the code) | 2026-11-25 | No | Yes |
| assets/audio/score_*.ogg (adaptive score: entry, intro, phase I, phase II, final, victory, defeat), ambience.ogg, impact.ogg, echo_form.ogg, echo_fade.ogg, ui.ogg | synthesized from scratch for this project with numpy (scripts/asset-pipeline/build_score.py): additive strings, organ, formant choir, piano, timpani, drums, bells, clock; no samples, no third-party audio, no commercial soundtracks | project | MIT (with the code) | 2026-11-26 | No | Yes |
| assets/audio/voice/w_*.ogg (17 Watcher lines incl. 5 rite invocations) | synthesized offline with Piper TTS (rhasspy/piper, MIT) voice model en-us-libritts-high (trained on LibriTTS, openslr.org/60, **CC BY 4.0**; speaker 498, no real actor imitated), then processed for this project (scripts/asset-pipeline/build_voice.py: pitch, rehearsed echo, whisper layer, cathedral reverb). Lines are original. | project + Piper/LibriTTS | Processed audio MIT with the code; **attribution required**: "Voice synthesized with Piper (rhasspy) using a model trained on LibriTTS (Zen et al., 2019), CC BY 4.0" | 2026-11-27 | Yes (AI-generated voice) | Yes |
| assets/audio/score_p1_x.ogg, score_p2_x.ogg, score_final_x.ogg | intensity layers synthesized for this project (scripts/asset-pipeline/build_layers.py) | project | MIT | 2026-11-27 | No | Yes |
| assets/audio/heartbeat.ogg, heartbeat_hard.ogg | synthesized (build_heartbeat.py) | project | MIT | 2026-11-27 | No | Yes |
| assets/fx/hex_bolt.glb | generated procedurally (build_bolt.py) | project | MIT | 2026-11-27 | No | Yes |
| assets/audio/*.ogg (22 gameplay cues) | synthesized from scratch for this project with numpy (scripts/asset-pipeline/build_audio.py); no samples or third-party audio | project | MIT (with the code) | 2026-11-26 | No | Yes |
| assets/telegraphs/*.glb | generated procedurally (scripts/asset-pipeline/build_telegraphs.py) | project | MIT (with the code) | 2026-11-26 | No | Yes |
| assets/environment/celestial_dial.glb, clock_hand.glb, armillary_ring.glb, light_shaft.glb; assets/images/chamber_floor.jpg | generated procedurally (scripts/asset-pipeline/build_ceiling.py); numerals set in DejaVu Serif Bold (Bitstream Vera licence, free to embed) | project | MIT (with the code) | 2026-11-26 | No | Yes |
| assets/fx/orb_*.glb, glow_*.glb, shard.glb; assets/environment/book.glb | generated procedurally (scripts/asset-pipeline/build_props.py) | project | MIT (with the code) | 2026-11-26 | No | Yes |
| assets/images/glow.png, spark.png | generated procedurally for this project (Python/PIL) | project | MIT (with the code) | 2026-11-25 | No | Yes |

## Third-party code

- Decentraland SDK7 (`@dcl/sdk`, `@dcl/js-runtime`): Apache-2.0, installed via npm, not vendored.
- Decentraland SDK skills: development aid only, not committed and not deployed. Reinstall with `npx skills add decentraland/sdk-skills --all` (version pinned in `skills-lock.json`).


Optimization and recolouring for all Aholo models: `scripts/asset-pipeline/` (README there; `env_batch.sh` for the environment set). Originals are not stored in the repo.

Note (2026-11-26): `astro_clock.glb` and `astro_rings.glb` (Aholo) are no longer placed in the scene (the ceiling now uses the procedural celestial dial); they stay in the repo for reference and are excluded from nothing else. Pillar, arch, window and door GLBs were geometry-smoothed (Taubin) and made fully matte (`/home/claude/tools/smoothmat.mjs`, copied to scripts/asset-pipeline).
