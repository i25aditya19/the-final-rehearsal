// Sound: original synthesized cues (assets/audio, scripts/asset-pipeline/build_audio.py).
// This system only OBSERVES game state and plays the matching cue, so gameplay code stays
// untouched. Every important cue also has a visual (GAME_DESIGN 11).
import { AudioSource, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { CONVERGENCE } from '../config'
import { state } from '../game/state'
import { attackDebug } from '../boss/attacks'
import { corruptionDebug } from '../boss/corruption'
import { readyGroup } from '../echoes/echoLogic'

const A = (n: string) => `assets/audio/${n}.ogg`
const MASTER = { sfx: 1.0, music: 0.45 }

const POOL = 8
const pool: Entity[] = []
let cursor = 0
const lastPlayed: Record<string, number> = {}
let musicChamber: Entity
let musicFinal: Entity

function sourceEntity(): Entity {
  const e = engine.addEntity()
  // Every AudioSource needs a Transform, even global ones.
  Transform.create(e, { position: Vector3.create(40, 2, 40) })
  return e
}

/** Play a one-shot cue (de-duplicated within `gap` seconds so bursts do not stack). */
export function sfx(name: string, volume = 1, gap = 0.06, pitch = 1) {
  const now = state.time
  if (lastPlayed[name] !== undefined && now - lastPlayed[name] < gap && now >= lastPlayed[name]) return
  lastPlayed[name] = now
  const e = pool[cursor++ % POOL]
  AudioSource.createOrReplace(e, { audioClipUrl: A(name), playing: false, loop: false, volume: volume * MASTER.sfx, pitch, global: true })
  AudioSource.playSound(e, A(name))
}

// ---------------------------------------------------------------- observed snapshot
const prev = {
  shots: 0, echoRepeats: 0, bossFlash: 0, deflect: -10, hit: -10, convergences: 0, redirects: 0,
  stage: 'fight' as string, phase: 'active' as string, bossPhase: 1, attack: undefined as string | undefined,
  gazeStage: 'off', waveWarn: 0, corruption: 'idle', ready: 0, runId: 0
}

export function initAudio() {
  for (let i = 0; i < POOL; i++) pool.push(sourceEntity())
  musicChamber = sourceEntity()
  musicFinal = sourceEntity()
  AudioSource.create(musicChamber, { audioClipUrl: A('music_chamber'), playing: true, loop: true, volume: MASTER.music, global: true })
  AudioSource.create(musicFinal, { audioClipUrl: A('music_final'), playing: true, loop: true, volume: 0, global: true })
  engine.addSystem(audioSystem, 50000, 'audio')
}

let musicLevel = { chamber: MASTER.music, final: 0 }

function audioSystem(dt: number) {
  const s = state
  if (s.runId !== prev.runId) {
    // Retry: forget the old run's counters.
    Object.assign(prev, { shots: 0, echoRepeats: 0, convergences: 0, redirects: 0, stage: 'fight', phase: 'active', bossPhase: 1, attack: undefined, gazeStage: 'off', waveWarn: 0, corruption: 'idle', ready: 0, runId: s.runId, bossFlash: 0, deflect: s.deflectAt, hit: s.playerHitAt })
  }

  // Player magic
  if (s.shots > prev.shots) sfx('cast', 0.8)
  if (s.echoRepeats > prev.echoRepeats) sfx('echo', 0.45, 0.15)
  const ready = readyGroup(s.echoes, s.time, CONVERGENCE.readyWindow).length
  if (ready >= 2 && prev.ready < 2 && s.time >= s.convergenceReadyAt) sfx('ready', 0.5, 0.5)
  if (s.convergences > prev.convergences && s.lastConvergence) {
    const n = Math.min(4, s.lastConvergence.hits)
    if (n >= 2) sfx(`converge${n}`, 1)
    else sfx('deflect', 0.6)
  }
  if (s.redirects > prev.redirects) sfx('converge2', 0.8, 0.06, 0.8)

  // Impacts
  if (s.bossFlashUntil !== prev.bossFlash && s.bossFlashUntil > s.time) sfx('hit', 0.55, 0.09)
  if (s.deflectAt !== prev.deflect) sfx('deflect', 0.5, 0.12)
  if (s.playerHitAt !== prev.hit && s.playerHitAt > 0) sfx('hurt', 0.9, 0.2)

  // Watcher attacks
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
    if (s.phase === 'victory') sfx('victory', 1)
    else if (s.phase === 'defeat') sfx('defeat', 0.9)
  }

  // Music: chamber theme, crossfading to the final theme in phase III; dips at the ending.
  const ending = s.phase !== 'active'
  const target = {
    chamber: ending ? 0 : s.bossPhase === 3 ? 0 : MASTER.music,
    final: ending ? 0 : s.bossPhase === 3 ? MASTER.music * 1.1 : 0
  }
  for (const key of ['chamber', 'final'] as const) {
    const cur = musicLevel[key]
    const next = cur + Math.sign(target[key] - cur) * Math.min(Math.abs(target[key] - cur), dt * 0.4)
    if (Math.abs(next - cur) > 1e-4) {
      musicLevel[key] = next
      const e = key === 'chamber' ? musicChamber : musicFinal
      const m = AudioSource.getMutableOrNull(e)
      if (m) m.volume = next
    }
  }
  if (s.runId !== prev.runId || (!ending && prev.phase !== 'active')) {
    // Back from the results screen: bring the chamber theme back.
    musicLevel = { chamber: musicLevel.chamber, final: musicLevel.final }
  }

  prev.shots = s.shots
  prev.echoRepeats = s.echoRepeats
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
