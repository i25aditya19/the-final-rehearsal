# THE FINAL REHEARSAL — Complete Game Reference

*Current state of the game as of 27 November 2026 (updated after the final competitive optimization pass, commit e7c6b34+). All numbers are live values from `src/config.ts`.*

---

## 1. Overview

| | |
|---|---|
| Genre | Single-player final-boss encounter (action / strategy) |
| Platform | Decentraland, SDK7 7.33 (TypeScript, ECS), desktop app and browser |
| Event | GAME OVER 2026 game jam by Regenesis Labs (itch.io/jam/game-over-2026) |
| Deadline | 30 Nov 2026, 23:59 UTC |
| Deploy target | Decentraland World `rgl10.dcl.eth` (not deployed yet; needs the creator's approval) |
| Repository | github.com/i25aditya19/the-final-rehearsal (public, MIT) |
| Length | One encounter, hard cap 285 s (4:45); bots win in about 93 s (humans expected 2.5–4 min) |
| Scene size | 5 × 5 parcels (80 × 80 m); arena centre (40, 0, 40) |

**Premise.** The player is a sorcerer trapped in a forbidden astronomical chamber with **The Watcher**, an ancient being who collects moments of time. The player has learned the Watcher's own forbidden magic: **every spell leaves an echo of the past that keeps repeating it.** The fight is a "rehearsal" that has happened many times before; winning means time finally moves forward again.

**Design pillar.** The player starts as an ordinary caster and ends as the master of time, building formations of their own past selves and synchronizing them into one decisive attack.

---

## 2. Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Camera / aim (cursor locked; click "take aim" first) |
| Left click | **Imprint** (cast a spell) |
| E | **Convergence** (fire your echoes together); also retry on the results screen |
| Space | Jump (avoids Aftershock rings and Volley bolts) |
| Esc / right-click | Free the cursor (to click UI buttons such as retry or the sound panel) |

There is no mana and there are no extra buttons. Developer keys (F refill, 1 mask swap) exist only when `UI.showDebug` is true, which is off in the competition build.

---

## 3. Player

- **Vitality:** 100. Heals **+15** at each phase transition.
- **Post-hit immunity:** 0.8 s (no double hits).
- The player loses when vitality reaches 0 or when the 285 s cap runs out.
- **Arena:** playable radius 20 m, a low carved parapet and colliders at about 23 m, and a central dais of 4.5 m radius.
- The arena is split into **4 sectors** (N, E, S, W) around the boss, with 8° hysteresis so the sector doesn't flicker at the boundaries. Sectors drive every directional mechanic.

---

## 4. Imprint: the core spell

- **Left click** fires a cyan projectile at the Watcher.
  - Cooldown 1 s, range 46 m, speed 34 m/s.
  - Aim assist: shots within 6° of the boss count as hits.
- **Direct hit damage: 5.**
- Each cast **leaves an echo at the spot where you cast it** (see 5).
- Casting at a corrupted echo's **anchor** takes priority: it interrupts or reclaims the echo and doesn't create a new one.

---

## 5. Echoes: the signature mechanic

An echo is a translucent cyan copy of the player, frozen at the casting spot. It **repeats the exact same spell** (same position, same direction) every **4 seconds**, dealing **3 damage** per repeat.

**Rules**
- Maximum **4 echoes**. A 5th replaces the oldest.
- Casting within **3 m** of an existing echo refreshes or replaces it, so you can't stack echoes on one spot.
- **Phase snap:** a new echo cast within 2 s of an existing echo's rhythm snaps into step with it, which makes synchronization natural.
- A new echo's first repeat comes at least 2 s after it's cast.
- At most **1 corrupted echo** can exist at a time.

**Visual language**
- Each echo materializes: it rises and grows over 0.5 s with a cyan burst.
- A **countdown rune** fills on the floor beneath it.
- The rune turns **gold** when the echo is about to fire (the "ready" window, 1 s).
- **Crimson** means corrupted.
- An **aim line** shows where it will shoot: cyan normally, gold when ready, crimson when stolen.

**Audio**
- Each echo slot plays its own note of a D-minor chord when it repeats, so synchronized echoes form a harmony.
- There are distinct sounds for an echo forming and an echo fading.

**HUD**
- Four echo slots show a countdown per echo and a colour state (cyan / gold / crimson).
- A **N/E/S/W compass** shows which sectors your echoes cover, and outlines your own sector.

---

## 6. Convergence: the decisive attack (E)

Pressing **E** makes your echoes fire **together** at the Watcher.

| Echoes firing together | Damage |
|---|---|
| 1 | No Convergence (gives advice instead) |
| 2 | 12 |
| 3 | 24 |
| 4 | **40, a "Perfect Convergence"** |

- The combined damage **replaces** those echoes' normal repeat damage, so nothing is double-counted.
- **Cooldown:** 6 s after a successful Convergence. **Invalid attempts never use up the cooldown.**
- **Directional value:** the Convergence records how many distinct **sectors** its echoes stand in. Gates and phase III require several sectors (see 8).

**How to trigger it**
1. **Natural timing (expert):** if 2 or more echoes are ready together (runes gold, within the 1 s window), E fires **instantly** and can't be interrupted.
2. **Synchronization charge (accessible):** if you have 2 or more friendly echoes that aren't in step, E starts a **1.3 s charge**. Their repeats are held, their runes turn gold together, and then they fire as one. **Getting hit during the charge breaks it** ("Synchronization broken"), and the cooldown isn't used up. Echoes can never get permanently stuck out of step.

**Feedback**
- Golden links appear between the participating echoes, thicker for more echoes, with a second, higher set for 3 or more.
- Gold beams fly from each echo's real position into the Watcher, with an impact burst that grows with the echo count.
- There are layered sound cues for 2, 3 and 4 echoes and a full-screen gold edge glow.
- The ceiling clock shudders on hits from 3 or more echoes, and its rings align on a perfect four.

**Perfect Convergence (4 echoes)** staggers the Watcher: no new attack for **3.5 s**. He sags, tips back and his halos slow.

**Failure advice:** checked *before* firing, so a Convergence that could not count never uses up the cooldown. The message names the exact reason:
- "Create another echo: cast from a second place."
- "Reclaim your corrupted echo, or create another echo."
- "Convergence is recovering (Ns)."
- "Wait for his sight to open: the Final Observation opens a window." (phase III)
- "He must be struck from 3 sides (you hold 2): create an echo to the west."

When a side requirement is active (phase II gate, phase III), the HUD compass pulses gold on each empty side and shows `SIDES 2/3`.

---

## 7. The Watcher (boss)

**Look**
- A slender, tall figure in black layered robes with silver embroidery and an **ivory mask**.
- A single **crimson eye** with a soft glow.
- **Three astronomical halos** behind his head, each rotating at its own speed (16, −10 and 6 °/s).
- Two floating **spectral hands**. A second, smaller pair grows in from phase II.

**Stats**
- **300 HP**, in three phases of 100.
- Hit volume: a cylinder of 2.1 m radius and 7.2 m height. He hovers at 3.85 m.

**Behaviour while idle**
- He levitates and leans, and his hands make slow gestures.
- He turns to face the player and briefly **glances at each new echo**.
- His eye pulses now and then.

**Telling you what's coming:** each attack has its own wind-up, so players can read him as well as the floor.

| Attack | Wind-up |
|---|---|
| Gaze | Eye flares, he leans in |
| Aftershock | Both hands rise high |
| Stolen Moment | The hand on the target's side reaches toward that echo |
| Blind Spot | Halos swell and tip |
| Final Observation | Posture opens wide, mask widens |
| Archive Volley | Hands circle |

**Player damage feedback:** a crimson marker on a ring around the crosshair points toward where the hit came from, relative to the camera, and names the attack. It adds "BEHIND" when the source is behind the player. Volley bolts and corrupted-echo shots use their real origin; other attacks point at the Watcher.

**When hit:** he jolts, a pale translucent afterimage flickers out behind him, and his halos shudder. Floating damage numbers appear.

**Temporal magic:** he uses the player's own power.
- A **crimson afterimage** of him performs his repeated Aftershock.
- At phase changes he "blinks" with an afterimage.

### Adaptive behaviour (rule-based, fair)
The Watcher picks attacks from a fixed per-phase order, reshuffled after the first pass (the first attack stays fixed). On top of that he **adapts**:

| What he sees | What he does |
|---|---|
| Player moved less than 3 m in 6 s | The Gaze ("You stand so still. I see you.") |
| 2+ echoes all in one sector | The Blind Spot ("All your moments in one place.") |
| 3+ echoes across 2+ sectors (phase II only) | Stolen Moment ("Such a fine formation... I will take it.") |
| Player hit 2+ times in 12 s | +2.5 s extra recovery before his next attack |

**Fairness limits**
- He only uses attacks his current phase already has.
- He adapts on at most every other attack.
- He never uses the same attack three times in a row.
- He never adaptively steals in phase III.

### Dialogue (voiced and subtitled, event-driven, never overlapping)
**Voice:** 12 lines are voiced. They were synthesized offline with Piper TTS, using a model trained on the LibriTTS corpus (CC BY 4.0), with a deep speaker and no real actor imitated. Each line was then processed: about 2 semitones lower, two faint delayed repeats (his "rehearsed" echo), a whisper layer and cathedral reverb, with a per-line delivery (calm, shocked, desperate, quiet). There's one voice source, so lines never overlap. Music ducks smoothly while he speaks, and danger cues aren't ducked. Subtitles always show. The introduction line plays only on the first run.
| Trigger | Line |
|---|---|
| Introduction (first run) | "How many times have we rehearsed this?" |
| First echo | "There you are. Again." |
| 3 friendly echoes | "You are multiplying moments." |
| 3 blocked spells within 6 s | "Predictable." |
| First Convergence | "You were never meant to learn that." |
| Echo corrupted | "Your past does not belong to you." |
| Echo reclaimed or released | "How did you take it back?" |
| Corruption reversal | "Impossible." |
| Player at 30 HP or less | "Another moment for my collection." |
| Gate broken | "Impossible... again?" / "You are rewriting my archive..." |
| Four echoes at once | "So many of you... all at once." |
| Boss at low HP | "Stop... rewriting... me..." |
| False victory | "Did you really believe this was the first time?" |
| Seal A broken | "You... see me?" |
| Seal B broken | "Stop... rewriting... me..." |
| Temporal Pursuit | "Even your footsteps belong to me." |
| Finale | "No... not this moment..." |
| Phase III begins | "I WILL NOT LOOK AWAY." |
| His defeat | "A moment I could not foresee..." |
| Player defeated | "This moment is mine to keep." |

---

## 8. Structure: phases, gates and transitions

The first attack comes at **12 s**. After each attack he waits **4.5 s** of recovery (×1.6 during gates).

### Phase I: THE OBSERVER (300 → 200 HP)
- **Attacks:** Gaze, Gaze, Aftershock (then reshuffled).
- **Damage:** normal.
- **Gate at 200 HP:** a barrier rises and blocks all damage (spells are visibly *deflected*). Only a **Convergence of 2+ echoes** breaks it.
- During the gate he only uses Gaze and Aftershock.

### Transition (3 s)
- No attacks; echoes are paused, so the formation stays in step.
- The player heals +15. A gold burst plays and the music ducks.

### Phase II: THE INTERFERENCE (200 → 100 HP)
- **Attacks:** Stolen Moment, Gaze, Blind Spot, Volley, Aftershock, Gaze, Blind Spot, Volley.
- **Damage rule:** ordinary spells and echo repeats deal only **25%**, *except* during the Blind Spot's vulnerability window. Convergence deals full damage.
- **Gate at 100 HP:** only a **Convergence of 3+ echoes from 3+ different sectors** breaks it.
- Halos become unstable and extra hands appear.

### The false victory (6.5 s, before phase III)
1. The Watcher **falls still** ("THE WATCHER FALLS STILL..."). His halos and the ceiling clock stop dead, and the music fades out.
2. At 2.85 s he speaks: *"Did you really believe this was the first time?"*
3. From 3.3 to 5.0 s the clock and halos **rewind backwards**, his crimson afterimage blinks, and the final theme surges in.
4. **No attacks, no damage.** Your echoes, health and progress are untouched.

### Phase III: THE ALL-SEEING (100 → 0 HP): three seals and the finale
- **Attacks:** Final Observation, Volley, Final Observation, Stolen Moment, Final Observation, Gaze, Volley.
- **His shield:** only a Convergence of **3+ echoes from 3+ sectors during an open window** of the Final Observation gets through. Redirects can't.
- **Three seals.** Each qualifying Convergence breaks one seal (34 HP), whether it used 3 or 4 echoes, so a three-echo strategy needs exactly three openings.
  - **Seal A, "his observation breaks":** he stops what he was doing, reels and gets 2.5 s of recovery.
  - **Seal B, "his control breaks":** he grows **desperate**. His recovery between attacks drops ×0.7 and his openings last +1 s.
  - **The four-echo advantage:** a Perfect Convergence (4 echoes, 4 sides) makes his sight **reopen immediately**. The next attack is the Final Observation again, which skips a cycle (about 10 s faster).
  - **Seal C starts THE FINALE.** He holds at 1 HP, and the formation that broke the seal is captured.
- **The finale (about 4 s, player-driven):**
  1. The echoes charge; "THE FINAL REHEARSAL · survive his last resistance".
  2. He says "No... not this moment..." and casts **one last telegraphed Aftershock ring** (1.6 s warning, jump it or use a gap).
  3. At 3.9 s the **finishing attack** fires: gold beams from every echo of the captured formation, from their real positions.
  4. Evade cleanly for "MOMENT EVADED · FLAWLESS FINALE". If the ring hits, it costs up to 10 HP but **never** takes the player below 1 HP, and nothing else can hurt the player during the finale. The time cap can't end a finale in progress.
- He grows during phase III: halos ×1.2 and racing, a larger mask, the ceiling rings expand, and **twelve eyes open around the chamber walls**.

---

## 9. Boss attacks in detail

Every damaging attack has a readable warning (a floor telegraph and a sound on the same frame, plus the boss's wind-up) and a legitimate counter. Telegraphs are mostly transparent with bright outlines, so the floor stays visible.

### The Gaze: reaction and movement
- A crimson cone (34°, 24 m range) **tracks the player during a 1.5 s warning**.
- It **locks 0.8 s before firing** and never tracks after the lock.
- An eye beam fires down the locked direction: **15 damage** if you're in the cone.
- **Counter:** step sideways out of the cone after it locks.

### Aftershock: timing and memory
- A crimson ring expands from 4.6 m at 10 m/s, 1.1 m wide, after a 1.5 s warning, dealing **10 damage**.
- It has **2 pale safe gaps** of 50° each.
- **It repeats exactly 4 s later**, performed by the Watcher's crimson temporal afterimage, with a bell sound for each wave.
- **Counter:** jump over the band (feet 0.45 m above the floor) or stand in a pale gap. You can't be hit twice by one wave.

### Archive Volley: dodging and spacing
- After a 1.3 s warning, **3 waves of 14 crimson bolts** spiral outward. Waves are 0.75 s apart, each rotated 9°, travelling at 9 m/s.
- **8 damage** per bolt hit (bolt radius 0.75 m).
- **Counter:** move into the gaps between bolts, or jump (bolts fly at 1.15 m; you clear them with feet above 0.9 m).

### Stolen Moment: echo management
1. He picks one friendly echo. A crimson tether and a floating **crimson anchor** appear above it, and his hand reaches toward it. *"Your past does not belong to you."*
2. **Warning, 2.5 s:** the echo's repetition cycle is **suspended**.
3. **If interrupted** (shoot the anchor, 0.9 m radius): "MOMENT RELEASED", a large cyan burst, and the echo fires immediately.
4. **If not interrupted:** the echo turns **hostile** (crimson). It aims at the player, charges for 1 s, locks for 0.7 s, then fires a crimson shot (12 damage) at the player's locked position at 26 m/s.
5. The hostile echo keeps attacking until it's **reclaimed** (shoot its anchor) or it **expires after 8 s**.

**Corruption reversal (advanced technique):** if the hostile shot's path passes through the Watcher, **it hits him for 15 damage** ("Impossible.").
- To use it, stand on the far side of the Watcher from the corrupted echo, then sidestep after its aim locks.
- For the first two corruptions, a pale marker on the floor shows where to stand.
- It counts toward the score and the USURPER achievement.
- It's never required to win.

### Temporal Pursuit: your past becomes your enemy (phase II, once per cycle; replaces the second Volley)
- The Watcher continuously records the player's last **4 s** of movement (a bounded buffer, sampled every 0.25 s).
- "Even your footsteps belong to me." The recorded path is **drawn as crimson marks** and **locked** during a **2 s** warning.
- Then a **crimson afterimage of the player** (the echo model in crimson) walks that exact path at the recorded pace. It **never steers toward the player's current position**.
- Touching it costs **8 damage, at most once**. A 0.5 s grace period after it appears means it can never land on the player unavoidably.
- If the player barely moved (under 2 m recorded), he uses a Gaze instead.
- **Lesson:** running in the same circles becomes dangerous. Your past spells are your weapon; your past steps can be your weakness.

### The Blind Spot: positioning
- For 3 s, three quadrants of the floor show **danger** and one quadrant, next to the player, is **safe and pale**. The message names it, e.g. "run to the pale quadrant (east)".
- At the end, anyone outside the safe quadrant or the central dais takes **15 damage**.
- Then comes a **5 s vulnerability window**: ordinary spells deal **full damage** in phase II instead of 25%.
- **Strategic bonus:** spells and echo repeats cast **from the exposed quadrant** deal **×1.5**. The exposed quadrant stays marked on the floor, and the message names it: "spells from the east strike ×1.5". Echoes already placed there benefit too. Other directions keep the normal full-damage window, so an imperfect formation isn't punished.
- Hits from the exposed quadrant count toward THE UNSEEN achievement.

### The Final Observation: mastery (phase III)
- After a 2.2 s warning, a crimson pulse covers the arena (**20 damage**) except for **pale safe discs** (3.2 m radius, placed at 62% of the arena radius).
- Then the shield **opens for 5.5 s**. Only now can a qualifying Convergence (3+ echoes, 3+ sectors) damage him. Then he rests for 3.5 s.
- **Counter:** stand in a safe disc, then fire a multi-sector Convergence during the opening.

---

## 10. Victory and defeat

### Victory sequence
1. The last qualifying Convergence lands, and **the music cuts out completely**.
2. **A single heartbeat** sounds in the silence (0.55 s).
3. **Gold beams** fire from the player's real echo positions, and gold motes rise.
4. The Watcher freezes, his halos swell and vanish, and he **shatters** into fragments. His hands fade and sink.
5. The ceiling clock **finally moves forward normally**: no more rewinding.
6. The **victory theme** plays: a D-major resolution with bells (1.8 s after victory).

The results screen then reads **"THE FINAL REHEARSAL — Time moves forward again."** It includes **"Your Final Rehearsal"**: a top-down miniature of the actual formation that fired the finishing attack. It shows the Watcher at the centre, your echoes as cyan dots with gold dotted lines to him, and the N/E/S/W quadrants. Beside it: "Four moments. One impossible outcome." (or Three, or Two), the number of echoes and directions, and "flawless finale" if earned.

### Defeat
The results screen reads **"A MOMENT LOST — The past can always be rewritten."** It shows:
- the reason ("Your vitality was exhausted by The Gaze" or "Time ran out")
- the phase reached
- time survived
- best Convergence
- vitality lost
- a tip matching the player's progress

Music: fading strings, then a clock that slows and stops.

### Retry
- Press **REHEARSE AGAIN / REWRITE THE MOMENT**, or E (after 6.5 s on victory, 1.2 s on defeat).
- The reset is **instant**, with no scene reload. Boss, player, echoes, corruption, projectiles, telegraphs, cooldowns, attack schedule, the adaptive memory, the Convergence charge, dialogue, audio and the timer all reset.
- Retries skip the title card and the intro music.

### Guided mode
After the **first defeat**, the results screen offers **REHEARSE WITH GUIDANCE** as a secondary button (normal retry stays primary):
- ready window 1.6 s instead of 1 s
- attack warnings +0.45 s longer
- gates and phase III need only 2 sectors
- 70% damage taken

The HUD marks it GUIDED. Guided results are labelled GUIDED on the results screen and keep their own personal best.

---

## 11. Scoring, ranks and achievements

**Mastery score** (maximum 10,000):
- **Speed:** up to 3000. Full at a 120 s finish, falling to 0 at 285 s.
- **Vitality:** remaining HP × 30, up to 3000.
- **Perfect Convergences:** 750 each, up to 4 (3000).
- **Redirects (corruption reversals):** 500 each, up to 2 (1000).

**Stalling audit:** Perfect Convergences only score when they **deal damage or break a barrier**, and redirects only when they damage him. So every scored action also advances the fight; there's no way to collect points while delaying. Healing is capped at 100. UNTOUCHABLE checks actual damage taken.

| Grade | Score | Rank name |
|---|---|---|
| S | ≥ 8500 | THE UNFORESEEN |
| A | ≥ 7000 | MASTER OF MOMENTS |
| B | ≥ 5000 | TIMEWEAVER |
| C | below | APPRENTICE |

A personal best is kept for the session ("NEW PERSONAL BEST"). Scenes have no local storage, so it doesn't persist between visits.

**Achievements:**

| Achievement | How to earn it |
|---|---|
| PRODIGY | Win in under 180 s |
| UNTOUCHABLE | Win without taking damage |
| PERFECT HARMONY | Land a four-echo Convergence |
| THE UNSEEN | Hit him from the Blind Spot |
| USURPER | Redirect a corrupted spell into him |
| MASTER OF MOMENTS | Reach S rank |

---

## 12. Onboarding and contextual help

- **First run only:** a title card (THE FINAL REHEARSAL) for the first 5.5 s, plus a boss-introduction music stinger. The player has control immediately.
- The objective line shows the current goal, e.g. "Wear him down with spells and echoes".
- There's a "Click to take aim" prompt.
- A pulsing **"PRESS E · CONVERGENCE"** appears when 2 echoes are ready, before the first Convergence. Otherwise a hint explains the synchronization charge.
- **Hints only when stuck** (each once per run, never on top of another message):
  - no cast after 7 s
  - only one echo for 14 s
  - all echoes on one side during the Blind Spot
  - the first Stolen Moment names the anchor counter
  - the redirect marker appears for the first two corruptions
- Gate messages say exactly what's needed, e.g. "Converge three echoes from three different sides."

---

## 13. World and presentation

**The chamber:** an enclosed Gothic astronomical cathedral with no visible sky.
- **Floor:** dark charcoal marble with moons, a zodiac ring, stars and a central eye emblem. Faint gameplay rings and quadrant lines.
- **Walls:**
  - a carved parapet at the arena edge
  - 12 Gothic pillars and 12 pointed arches
  - stained-glass windows with soft **moonlight shafts** leaning into the room
  - ashlar walls with dark carved cornices
  - a ribbed vault painted as a star map
- **Ceiling:** a giant **celestial clock**, with a readable engraved dial (Roman numerals, zodiac band, star field, compass rose) in front of an ornate metallic mechanism, plus clean armillary rings.
  - The clock hands **sweep forward, then rewind to the same moment** (the rehearsal repeating).
  - It races during phase changes, stops and rewinds in the false victory, shudders on big hits, aligns on Perfect Convergence, and runs freely at victory.
- **Atmosphere:** 24 candles floating at several heights, 12 drifting books, twinkling vault stars, dust motes, and faint spectral silhouettes in the windows.

**Palette:** strict monochrome (obsidian, charcoal, mid-grey, antique silver, ash, ivory). Colour carries meaning:

| Colour | Meaning |
|---|---|
| Cyan | Player magic and friendly echoes |
| Crimson | The Watcher, danger, corrupted echoes |
| Gold | Synchronization, mastery, victory |
| White | Concentrated energy |

**HUD (Gothic):**
- serif titles, thin silver borders, dark panels
- boss bar with phase names and a gold barrier segment
- player vitality, an imprint cooldown ring, echo slots with a compass, a Convergence indicator
- attack warning banners, serif subtitles, damage numbers
- a sound panel: music and effects levels, mute

**Lighting:**
- The scene sets its own neutral sky ambient, a dim neutral sun with no disc, and charcoal fog.
- 5 silver point lights, a key spotlight on the Watcher, and a cool rim light behind his head: **7 lights** in total, within mobile limits.

---

## 13b. Endings
- **Defeat:** the avatar is knocked out (built-in `knockOut` emote), movement is held for 2.6 s, every echo shatters into crimson and the screen closes in. Results appear at 2.8 s.
- **Victory:**
  - The avatar strikes the `Victory` pose and the echoes rise as gold light.
  - A **16 s continuous cinematic camera** plays, with letterbox bars and titles: a hero close-up, a crane over the arena, a high view of the floor emblem, up through the dome, and a wide exterior of the chamber.
  - **E skips** it.
  - The results then reveal themselves: the score tallies, the rank stamps in and achievements chime in.

## 14. Audio

All music and sound is **original, synthesized in code** for this project (no samples, no licensed or commercial music).

**Adaptive score** (D minor):

| Moment | Music |
|---|---|
| Chamber entry | Distant choir, clock ticking, sparse piano |
| Boss introduction (first run) | Organ swell and timpani roll building to a full hit |
| Phase I | Tense string ostinato, controlled timpani and frame drum |
| Phase II | Faster strings and melody, organ, heavier drums |
| Phase III | Full choir, organ, cinematic drums |
| Victory | Silence, heartbeat, then a D-major resolution with bells |
| Defeat | Fading strings, then a clock that slows and stops |

- **Intensity layers:** each combat phase has a matching layer (taiko, brass stabs, tense tremolo strings, a ticking clock, risers) locked to its tempo. It plays quietly in every fight (30%, 42% or 55% by phase) and rises to full as the player's vitality falls to 30 or below. It's always full in the finale. Below 30 HP the vitality bar pulses and a quiet heartbeat plays.
- All loops play from scene load and **crossfade by volume over 2.5 s**, so nothing restarts, duplicates or overlaps.
- Music ducks during transitions and falls silent in the false victory.

**Ambience:** distant cathedral bells, a clock mechanism, faint whispers and air, kept quiet.

**About 30 sound effects:**
- casting, impact and boss damage
- echo forming, repeating (harmonic notes) and fading
- Convergence ready, and Convergence for 2, 3 and 4 echoes
- blocked spells
- Gaze warning and fire, Aftershock bells, Volley, Blind Spot, Stolen Moment and Final Observation
- gate break, phase change, player hurt, victory, defeat, UI click, heartbeat

Danger cues fire on the same frame as their telegraph. Every essential sound also has a visual equivalent.

---

## 15. Technical notes

- **Architecture:** ECS systems. Pure rule modules (aim, echo logic, attack math, phase rules, adaptive picker) are unit-tested. Observer systems for audio and feedback watch game state, so presentation never changes gameplay. One shared `state` object.
- **Performance:**
  - pooled projectiles, tracers and bolts, with hidden pooled meshes removed from rendering via `VisibilityComponent`
  - low-poly shared orb models instead of built-in spheres
  - 7 lights and 8 particle emitters
  - a placeholder Watcher that's deleted once the models load
- **Multiplayer:** no shared state (no `syncEntity` or MessageBus), so every visitor runs their own private encounter. Other avatars are visible but can't interfere. Not yet tested with two real visitors.
- **Tests:**
  - 51 unit tests
  - headless bot playtests (`npm run sim`): novice, average and skilled bots all win, in about 160–172 s
  - QA suite (`npm run sim:qa`), 12 of 12 passing: 10 consecutive restarts, no leftover timers, the charge works, a hit breaks the charge, the false victory keeps the formation, no damage after victory, the adaptive Gaze, seal → seal → finale with three echoes, a finale that can't kill and beats the time cap, the formation captured, Temporal Pursuit never chasing, and a pursuit hit landing only once
  - audio restart check (`npm run sim:audio`)
- **Assets:**
  - Watcher, pillars, arches, windows, door and ornate clock: Aholo-generated models, cleared by the creator for publishing
  - everything else, including all audio: procedural or original
  - every asset is logged in `docs/ASSETS.md`

---

## 15b. Playtest telemetry (local only)
At the end of every run, a one-line JSON summary is printed to the preview console (Local Tools → Console), tagged `[FinalRehearsal telemetry]`. It covers:
- time to first cast, first echo and first Convergence
- failed Convergence attempts by reason
- the times each phase was reached, and seals broken
- damage taken by attack, and the death cause
- echoes placed per side (N/E/S/W)
- Perfect Convergences, redirects and Blind Spot hits
- score, grade, guided mode and restart count
- average FPS and worst frame FPS

Nothing is sent anywhere. Turn it off with `UI.telemetry = false` in `src/config.ts`.

## 16. Current status and open issues

- **Floor colour:** the floor rendered red in the desktop app, because Decentraland's default ground was covering our floor model. The fix (a textured flat-surface floor at 8 cm with a collider) has been pushed but **not yet confirmed in the app**.
- **Not yet human-playtested:** difficulty, jump detection in the app, and how readable the attacks are.
- **Not yet tested with two visitors at once.**
- **Not implemented:**
  - a personal best saved between visits
  - real movement for the Watcher (he stays centred so recorded echo aim stays valid; movement is visual only: blinks and afterimages)
  - hit-pause effects (impact is conveyed by stagger, recoil, afterimages and light instead)
- **Still to do before the deadline:** an in-app visual check, a human playtest, itch.io page text and screenshots or a trailer, and the deploy to `rgl10.dcl.eth` (creator signs, ideally by 29 Nov).
- **Weakest judging category right now:** World Design & Presentation. The visuals are unverified in the app since the floor fix, and the architecture uses AI-generated meshes.
