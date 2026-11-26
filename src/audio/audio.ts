// Sound: an original adaptive score, ambience and gameplay cues, all synthesized for this project
// (assets/audio; scripts/asset-pipeline/build_score.py and build_audio.py; MIT, no samples).
//
// This system only OBSERVES game state and plays the matching sound, so gameplay code (mechanics,
// timings) is untouched; attack warnings fire on the same frame the telegraph starts.
//
// Music: four seamless loops (entry, phase I, phase II, final) and the ambience all play from
// scene start, muted, and are mixed by volume only: no restarts, no duplicate sources on retry,
// smooth ~2.5 s crossfades. The boss introduction, victory and defeat are one-shot stingers on
// one dedicated source (a new stinger replaces the old one, so they never overlap).
// Volume: music / effects levels and mute (audioSettings), driven by the HUD sound panel.
// Autoplay: the explorer starts scene audio once the player has entered/clicked; the score is
// mixed from game state each frame, so it is correct whenever audio becomes audible.
import { AudioSource, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { readyWindow } from '../game/assist'
import { falseVictory, state } from '../game/state'
import { attackDebug } from '../boss/attacks'
import { corruptionDebug } from '../boss/corruption'
import { readyGroup } from '../echoes/echoLogic'

const A = (n: string) => `assets/audio/${n}.ogg`

/** Player-adjustable (HUD sound panel). Levels 0..1. */
export const audioSettings = { music: 0.8, sfx: 1.0, muted: false }
export const LEVEL_STEPS = 10

type Loop = 'score_entry' | 'score_p1' | 'score_p2' | 'score_final' | 'ambience'
const LOOPS: Loop[] = ['score_entry', 'score_p1', 'score_p2', 'score_final', 'ambience']
/** Mix level of each loop at full music volume. */
const BASE: Record<Loop, number> = { score_entry: 0.55, score_p1: 0.6, score_p2: 0.62, score_final: 0.66, ambience: 0.3 }
const STINGER_BASE = { score_intro: 0.75, score_victory: 0.75, score_defeat: 0.7 }
const CROSSFADE = 2.5 // seconds for a full crossfade
/** Run time at which the boss-introduction stinger has built up and phase I takes over. */
const INTRO_AT = 0.6
const PHASE1_AT = 7.6

const POOL = 10
const pool: Entity[] = []
let cursor = 0
const lastPlayed: Record<string, number> = {}
const loops = new Map<Loop, { e: Entity; level: number; written: number }>()
let stinger: Entity
let stingerName: keyof typeof STINGER_BASE | '' = ''
let stingerLevel = 0
let stingerWritten = -1
let victoryStep = 0

function sourceEntity(): Entity {
  const e = engine.addEntity()
  // Every AudioSource needs a Transform, even global ones.
  Transform.create(e, { position: Vector3.create(40, 2, 40) })
  return e
}

const sfxGain = () => (audioSettings.muted ? 0 : audioSettings.sfx)
const musicGain = () => (audioSettings.muted ? 0 : audioSettings.music)

/** Play a one-shot cue (de-duplicated within `gap` seconds so bursts do not stack). */
export function sfx(name: string, volume = 1, gap = 0.06, pitch = 1) {
  const now = state.time
  if (lastPlayed[name] !== undefined && now - lastPlayed[name] < gap && now >= lastPlayed[name]) return
  lastPlayed[name] = now
  const v = volume * sfxGain()
  if (v <= 0) return
  const e = pool[cursor++ % POOL]
  AudioSource.createOrReplace(e, { audioClipUrl: A(name), playing: false, loop: false, volume: v, pitch, global: true })
  AudioSource.playSound(e, A(name))
}

/** UI feedback (buttons, sound panel). */
export function uiClick() {
  sfx('ui', 0.6, 0.03)
}

function playStinger(name: keyof typeof STINGER_BASE) {
  stingerName = name
  stingerLevel = 1
  stingerWritten = -1
  AudioSource.createOrReplace(stinger, { audioClipUrl: A(name), playing: false, loop: false, volume: STINGER_BASE[name] * musicGain(), global: true })
  AudioSource.playSound(stinger, A(name))
}

// ---------------------------------------------------------------- observed snapshot
const prev = {
  shots: 0, echoRepeats: 0, bossFlash: 0, deflect: -10, hit: -10, convergences: 0, redirects: 0,
  stage: 'fight' as string, phase: 'active' as string, bossPhase: 1, attack: undefined as string | undefined,
  gazeStage: 'off', waveWarn: 0, corruption: 'idle', ready: 0, runId: -1, echoIds: [] as number[], introPlayed: false
}

export function initAudio() {
  // Guard: initAudio runs once per scene load; a reload rebuilds the whole scene, so nothing doubles.
  if (pool.length) return
  for (let i = 0; i < POOL; i++) pool.push(sourceEntity())
  for (const name of LOOPS) {
    const e = sourceEntity()
    AudioSource.create(e, { audioClipUrl: A(name), playing: true, loop: true, volume: 0, global: true })
    loops.set(name, { e, level: 0, written: 0 })
  }
  stinger = sourceEntity()
  engine.addSystem(audioSystem, 50000, 'audio')
}

/** Which loop should be heard now, and how loud the ambience is. */
function musicTargets(): Record<Loop, number> {
  const s = state
  const t: Record<Loop, number> = { score_entry: 0, score_p1: 0, score_p2: 0, score_final: 0, ambience: 1 }
  const sinceEnd = s.time - s.endedAt
  if (s.phase === 'victory') {
    if (sinceEnd > 15) t.score_entry = 0.7
  } else if (s.phase === 'defeat') {
    if (sinceEnd > 11) t.score_entry = 0.7
  } else if (s.time < PHASE1_AT) {
    t.score_entry = 1
  } else {
    const k: Loop = s.bossPhase === 3 ? 'score_final' : s.bossPhase === 2 ? 'score_p2' : 'score_p1'
    t[k] = s.stage === 'transition' ? 0.55 : 1 // duck under the phase-change sound
    const fv = falseVictory()
    if (fv) {
      // false victory: the music falls away; the final theme surges in with the rewind
      t[k] = 0
      t.ambience = fv.still ? 0.35 : 0.6
      if (fv.e >= 3.3) t.score_final = 1
    }
    t.ambience = s.bossPhase === 3 ? 0.5 : 0.8
  }
  return t
}

function mixMusic(dt: number) {
  const targets = musicTargets()
  const g = musicGain()
  const step = Math.min(0.1, dt) / CROSSFADE
  for (const [name, L] of loops) {
    const goal = targets[name]
    const fast = goal < L.level && (state.phase === 'defeat' ? 1.6 : state.phase === 'victory' ? 6 : 1)
    L.level += Math.sign(goal - L.level) * Math.min(Math.abs(goal - L.level), step * (fast || 1))
    const vol = L.level * BASE[name] * g
    if (Math.abs(vol - L.written) > 0.002 || (vol === 0 && L.written !== 0)) {
      L.written = vol
      const m = AudioSource.getMutableOrNull(L.e)
      if (m) m.volume = vol
    }
  }
  // A stinger fades out quickly if the player retries while it is still sounding.
  if (stingerName) {
    const stale = (stingerName === 'score_intro' && state.phase !== 'active') || (stingerName !== 'score_intro' && state.phase === 'active')
    if (stale) stingerLevel = Math.max(0, stingerLevel - Math.min(0.1, dt) / 0.8)
    const vol = stingerLevel * STINGER_BASE[stingerName] * g
    if (Math.abs(vol - stingerWritten) > 0.002) {
      stingerWritten = vol
      const m = AudioSource.getMutableOrNull(stinger)
      if (m) m.volume = vol
    }
  }
}

function audioSystem(dt: number) {
  const s = state
  if (s.runId !== prev.runId) {
    // New run (first load or retry): forget the old run's counters; the intro plays again.
    Object.assign(prev, {
      shots: 0, echoRepeats: 0, convergences: 0, redirects: 0, stage: 'fight', phase: 'active', bossPhase: 1, attack: undefined,
      gazeStage: 'off', waveWarn: 0, corruption: 'idle', ready: 0, runId: s.runId, bossFlash: 0, deflect: s.deflectAt, hit: s.playerHitAt,
      echoIds: [], introPlayed: false
    })
    victoryStep = 0
  }
  if (!prev.introPlayed && s.phase === 'active' && s.time >= INTRO_AT) {
    prev.introPlayed = true
    if (s.runId === 1) playStinger('score_intro') // the introduction plays once, not on every retry
  }
  // Victory: the music cuts out, a single heartbeat in the silence, then the resolution.
  if (s.phase === 'victory' && victoryStep === 1 && s.time - s.endedAt >= 0.55) {
    victoryStep = 2
    sfx('heartbeat', 1, 1)
  }
  if (s.phase === 'victory' && victoryStep === 2 && s.time - s.endedAt >= 1.8) {
    victoryStep = 3
    sfx('victory', 0.8)
    playStinger('score_victory')
  }

  // Player magic
  if (s.shots > prev.shots) sfx('cast', 0.8)
  // Each echo slot sings its own note of a D-minor chord, so synchronized echoes form a harmony.
  if (s.echoRepeats > prev.echoRepeats) {
    const firing = s.echoes.findIndex((e) => s.time - e.lastFired < 0.05)
    sfx('echo', 0.45, 0.15, [1, 1.189, 1.498, 2][Math.max(0, firing) % 4])
  }
  const ids = s.echoes.map((e) => e.id)
  if (ids.some((id) => !prev.echoIds.includes(id))) sfx('echo_form', 0.55, 0.1)
  if (s.phase === 'active' && prev.echoIds.some((id) => !ids.includes(id))) sfx('echo_fade', 0.45, 0.2)
  const ready = readyGroup(s.echoes, s.time, readyWindow()).length
  if (ready >= 2 && prev.ready < 2 && s.time >= s.convergenceReadyAt) sfx('ready', 0.5, 0.5)
  if (s.convergences > prev.convergences && s.lastConvergence) {
    const n = Math.min(4, s.lastConvergence.hits)
    if (n >= 2) sfx(`converge${n}`, 1)
    else sfx('deflect', 0.6)
  }
  if (s.redirects > prev.redirects) sfx('converge2', 0.8, 0.06, 0.8)

  // Impacts: the spell lands (glassy impact) and the Watcher is hurt (resonant hit).
  if (s.bossFlashUntil !== prev.bossFlash && s.bossFlashUntil > s.time) {
    sfx('impact', 0.5, 0.08)
    sfx('hit', 0.5, 0.09)
  }
  if (s.deflectAt !== prev.deflect) sfx('deflect', 0.5, 0.12)
  if (s.playerHitAt !== prev.hit && s.playerHitAt > 0) sfx('hurt', 0.9, 0.2)

  // Watcher attacks: the warning sounds on the frame the telegraph appears.
  const dbg = attackDebug()
  if (dbg.kind !== prev.attack && dbg.kind) {
    if (dbg.kind === 'gaze') sfx('gaze_warn', 0.8)
    else if (dbg.kind === 'blindspot') sfx('blindspot', 0.85)
    else if (dbg.kind === 'observation') sfx('observation', 0.95)
    else if (dbg.kind === 'volley') sfx('volley', 0.8)
  }
  if (dbg.kind === 'gaze' && dbg.gazeStage === 'fire' && prev.gazeStage !== 'fire') sfx('gaze_fire', 0.9)
  if (dbg.kind === 'aftershock') {
    const warned = dbg.waves.filter((w) => s.time >= w.warnAt).length
    if (warned > prev.waveWarn) sfx('bell', 0.9, 0.5)
    prev.waveWarn = warned
  } else prev.waveWarn = 0
  const cm = corruptionDebug().mode
  if (cm === 'warning' && prev.corruption !== 'warning') sfx('corruption', 0.85)

  // Structure
  if (s.stage === 'transition' && prev.stage !== 'transition') sfx(prev.stage === 'gate' ? 'gate_break' : 'phase', 1)
  if (s.stage === 'fight' && prev.stage === 'transition') sfx('phase', 0.8)
  if (s.phase !== prev.phase) {
    if (s.phase === 'victory') {
      victoryStep = 1
    } else if (s.phase === 'defeat') {
      sfx('defeat', 0.7)
      playStinger('score_defeat')
    }
  }

  mixMusic(dt)

  prev.shots = s.shots
  prev.echoRepeats = s.echoRepeats
  prev.echoIds = ids
  prev.ready = ready
  prev.convergences = s.convergences
  prev.redirects = s.redirects
  prev.bossFlash = s.bossFlashUntil
  prev.deflect = s.deflectAt
  prev.hit = s.playerHitAt
  prev.attack = dbg.kind
  prev.gazeStage = dbg.gazeStage
  prev.corruption = cm
  prev.stage = s.stage
  prev.phase = s.phase
  prev.bossPhase = s.bossPhase
}

/** For the sim / debug: current mix. */
export function audioDebug() {
  const out: Record<string, number> = {}
  for (const [n, L] of loops) out[n] = Math.round(L.written * 100) / 100
  return { loops: out, stinger: stingerName, stingerVol: Math.round(stingerWritten * 100) / 100 }
}
