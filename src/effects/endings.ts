// Endings: what the player's own body and echoes do when the fight is decided.
// Observes state only (gameplay untouched).
//  Defeat:  the avatar is knocked out (built-in 'knockOut' emote), movement is held so the fall
//           plays through, every echo shatters into crimson, the screen closes in (hud.tsx).
//  Victory: after the Watcher shatters, the avatar strikes the 'Victory' pose, the imprisoned
//           echoes are released as gold light rising to the vault, then the results tally (hud.tsx).
// Emotes are embedded in the Explorer (no download). Movement is released on retry or after the hold.
import { InputModifier, engine } from '@dcl/sdk/ecs'
import { triggerEmote } from '~system/RestrictedActions'
import { COLORS } from '../config'
import { state } from '../game/state'
import { onReset } from '../game/session'
import { burst } from './vfx'
import { spawnTracer } from './tracers'
import { sfx } from '../audio/audio'

let seenPhase = 'active'
let held = false
let step = 0
let echoesAt: { x: number; z: number }[] = []

function hold(on: boolean) {
  if (on === held) return
  held = on
  if (on) InputModifier.createOrReplace(engine.PlayerEntity, { mode: InputModifier.Mode.Standard({ disableAll: true }) })
  else InputModifier.deleteFrom(engine.PlayerEntity)
}

function emote(id: string) {
  // Fire and forget; a failed emote (e.g. on a client without it) changes nothing else.
  triggerEmote({ predefinedEmote: id }).catch(() => undefined)
}

export function initEndings() {
  engine.addSystem(endingsSystem, 40000, 'endings')
  onReset(() => {
    hold(false)
    seenPhase = 'active'
    step = 0
  })
}

function endingsSystem() {
  const s = state
  if (s.phase !== seenPhase) {
    seenPhase = s.phase
    step = 0
    echoesAt = s.echoes.map((e) => ({ x: e.pos.x, z: e.pos.z }))
  }
  if (s.phase === 'active') return
  const t = s.time - s.endedAt

  if (s.phase === 'defeat') {
    if (step === 0) {
      step = 1
      hold(true)
      emote('knockOut')
    }
    if (step === 1 && t >= 0.35) {
      step = 2
      // every echo shatters: the moments are lost
      for (const p of echoesAt) burst({ x: p.x, y: 1.2, z: p.z }, COLORS.dangerCrimson, 1.3)
      s.echoes.length = 0
      sfx('echo_fade', 0.8, 0.05, 0.7)
    }
    if (step === 2 && t >= 2.6) {
      step = 3
      hold(false)
    }
    return
  }

  // victory
  if (step === 0) {
    step = 1
    hold(true) // watch him fall; the camera stays steady
  }
  if (step === 1 && t >= 2.3) {
    step = 2
    emote('Victory')
  }
  if (step === 2 && t >= 2.8) {
    step = 3
    // the imprisoned echoes are released: gold light rising to the vault
    const from = echoesAt.length ? echoesAt : s.finalFormation
    for (const p of from) {
      spawnTracer({ x: p.x, y: 0.4, z: p.z }, { x: p.x, y: 26, z: p.z }, COLORS.syncGold, false, { width: 0.28, seconds: 2.2, intensity: 7 })
      burst({ x: p.x, y: 1.4, z: p.z }, COLORS.syncGold, 1.4)
    }
    s.echoes.length = 0
    sfx('echo_form', 0.8, 0.05, 1.5)
  }
  if (step === 3 && t >= 4.2) {
    step = 4
    hold(false)
  }
  // results reveal (hud.tsx): the score tallies, the rank stamps, achievements chime in one by one
  if (step === 4 && t >= 6.6) {
    step = 5
    sfx('ready', 0.6)
  }
  if (step === 5 && t >= 6.5 + 1.7) {
    step = 6
    sfx('converge3', 0.75)
  }
  const ach = Math.floor((t - 6.5 - 2.0) / 0.4) + 1
  if (step >= 6 && ach > step - 6 && step - 6 < s.achievements.length) {
    step++
    sfx('echo_form', 0.6, 0.05, 1 + 0.12 * (step - 7))
  }
}
