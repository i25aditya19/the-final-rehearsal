// Stolen Moment (GAME_DESIGN 7.3): the Watcher tethers one friendly echo. Shoot the glowing
// anchor during the 2.5 s warning to interrupt. Otherwise the echo turns crimson and fires
// aimed hostile shots at you (dodge them, or stand so the shot passes through the Watcher to
// redirect it: damages him and restores the echo). Shooting the anchor reclaims it at any time;
// it also expires by itself after 8 s. A corrupted echo is never silently deleted.
import { Entity, Material, MaterialTransparencyMode, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, COLORS, CORRUPTION, ECHO } from '../config'
import { pointSegmentDistance, segmentCylinderT, stopDistance } from '../combat/aim'
import { V3, add, norm, scale, sub, v3 } from '../math/vec'
import { damagePlayer, say, speak, state } from '../game/state'
import { onReset } from '../game/session'
import { hitBoss } from '../game/phases'
import { bossHitVolume, watcherEyePosition } from './watcher'
import { launch } from '../effects/projectiles'
import { burst } from '../effects/vfx'
import { Echo, firstFireTime } from '../echoes/echoLogic'

type Mode = 'idle' | 'warning' | 'corrupted'
let mode: Mode = 'idle'
let targetId = -1
let modeAt = 0
let shotStage: 'charge' | 'lock' | 'flight' = 'charge'
let shotAt = 0
let lockedEnd: V3 = v3(0, 0, 0)
let lastCorruptionEnd = -100

let tether: Entity
let anchor: Entity
let aimLine: Entity
const HIDDEN = Vector3.create(0, -40, 0)
const AXIS_FIX = Quaternion.fromEulerDegrees(90, 0, 0)
const WALL = { center: ARENA.center, wallRadius: ARENA.playableRadius + ARENA.borderMargin }

const glow = (e: Entity, hex: string, alpha: number, intensity: number) => {
  const c = Color4.fromHexString(hex)
  Material.setPbrMaterial(e, {
    albedoColor: Color4.create(c.r, c.g, c.b, alpha),
    emissiveColor: Color3.create(c.r, c.g, c.b),
    emissiveIntensity: intensity,
    transparencyMode: alpha < 1 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : MaterialTransparencyMode.MTM_AUTO
  })
}

export function initCorruption() {
  tether = engine.addEntity()
  Transform.create(tether, { position: HIDDEN })
  MeshRenderer.setCylinder(tether)
  glow(tether, COLORS.dangerCrimson, 0.75, 4)
  anchor = engine.addEntity()
  Transform.create(anchor, { position: HIDDEN })
  MeshRenderer.setSphere(anchor)
  glow(anchor, COLORS.dangerCrimson, 0.9, 6)
  aimLine = engine.addEntity()
  Transform.create(aimLine, { position: HIDDEN })
  MeshRenderer.setCylinder(aimLine)
  glow(aimLine, COLORS.dangerCrimson, 0.6, 3)
  engine.addSystem(corruptionVisuals)
  onReset(() => {
    mode = 'idle'
    targetId = -1
    lastCorruptionEnd = -100
    hideAll()
  })
}

function target(): Echo | undefined {
  return state.echoes.find((e) => e.id === targetId)
}

/** Can a Stolen Moment start now? Needs a friendly echo and the global cooldown elapsed. */
export function corruptionReady(): boolean {
  return mode === 'idle' && state.time - lastCorruptionEnd >= CORRUPTION.initialInterval && state.echoes.some((e) => !e.corrupted)
}

export function startCorruption(): boolean {
  if (!corruptionReady()) return false
  // Prefer the echo nearest the player: the threat should be readable and close.
  const p = Transform.has(engine.PlayerEntity) ? Transform.get(engine.PlayerEntity).position : undefined
  const friendly = state.echoes.filter((e) => !e.corrupted)
  friendly.sort((a, b) => (p ? Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z) : 0))
  targetId = friendly[0].id
  mode = 'warning'
  modeAt = state.time
  speak('corruption', 'Your past does not belong to you.')
  say('STOLEN MOMENT  ·  shoot the crimson anchor to save your echo', 3)
  return true
}

/** Anchor sphere for Imprint to test against (priority over the boss). */
export function corruptionAnchor(): { center: V3; radius: number } | undefined {
  const e = target()
  if (mode === 'idle' || !e) return undefined
  return { center: v3(e.pos.x, CORRUPTION.anchorHeight, e.pos.z), radius: CORRUPTION.anchorRadius }
}

/** Called when a player's spell reaches the anchor: interrupt or reclaim. */
export function strikeAnchor() {
  const e = target()
  if (!e || mode === 'idle') return
  burst(v3(e.pos.x, CORRUPTION.anchorHeight, e.pos.z), COLORS.echoCyan, 1.4)
  say(mode === 'warning' ? 'Moment protected' : 'Moment reclaimed', 1.8)
  restore(e)
}

function restore(e: Echo) {
  e.corrupted = false
  e.nextFire = firstFireTime(state.echoes, state.time, {
    maxSlots: ECHO.maxSlots, minSeparation: ECHO.minSeparation, repeatInterval: ECHO.repeatInterval,
    phaseSnap: ECHO.phaseSnap, minFirstDelay: ECHO.minFirstDelay, playableRadius: ARENA.playableRadius, center: ARENA.center
  }, e.id)
  end()
}

function end() {
  mode = 'idle'
  targetId = -1
  lastCorruptionEnd = state.time
  hideAll()
}

/** Scheduler hook: returns true when the Stolen Moment has fully resolved. */
export function updateCorruption(): boolean {
  if (mode === 'idle') return true
  const e = target()
  if (!e) {
    end()
    return true
  }
  if (mode === 'warning') {
    if (state.time - modeAt >= CORRUPTION.warning) {
      e.corrupted = true
      mode = 'corrupted'
      modeAt = state.time
      shotStage = 'charge'
      shotAt = state.time
      say('Your echo is turned against you: dodge, or let its spell pass through him', 3)
    }
    return false
  }
  // Corrupted: expire safely if unresolved.
  if (state.time - modeAt >= CORRUPTION.autoExpire) {
    restore(e)
    say('The stolen moment fades back to you', 1.8)
    return true
  }
  const p = Transform.has(engine.PlayerEntity) ? Transform.get(engine.PlayerEntity).position : undefined
  const origin = v3(e.pos.x, CORRUPTION.anchorHeight, e.pos.z)
  if (shotStage === 'charge') {
    if (p) lockedEnd = v3(p.x, 1.0, p.z)
    if (state.time - shotAt >= CORRUPTION.charge) {
      shotStage = 'lock'
      shotAt = state.time
    }
  } else if (shotStage === 'lock' && state.time - shotAt >= CORRUPTION.lock) {
    fireHostile(e, origin)
    shotStage = 'flight'
    shotAt = state.time
  } else if (shotStage === 'flight' && state.time - shotAt >= 1.4) {
    shotStage = 'charge'
    shotAt = state.time
  }
  return false
}

function fireHostile(e: Echo, origin: V3) {
  const dir = norm(sub(lockedEnd, origin))
  dir.y = 0
  const d = norm(dir)
  const boss = bossHitVolume()
  const tBoss = segmentCylinderT(origin, d, boss, 60)
  const tWall = stopDistance(origin, d, WALL.center, WALL.wallRadius, 60)
  const toPlayer = Math.hypot(lockedEnd.x - origin.x, lockedEnd.z - origin.z)
  // Redirect: the Watcher stands between the echo and the locked aim point.
  const redirected = tBoss !== null && tBoss < toPlayer + 0.5
  const endT = redirected ? tBoss! : tWall
  const end = add(origin, scale(d, endT))
  const run = state.runId
  launch(origin, end, COLORS.dangerCrimson, redirected, () => {
    if (run !== state.runId) return
    if (redirected) {
      const out = hitBoss('redirect', CORRUPTION.redirectDamage, undefined, end)
      if (out.damage > 0) {
        state.redirects++
        say(`REDIRECTED  ·  ${Math.round(out.damage)} damage  ·  echo restored`, 2.5)
      } else say('Redirected, but his barrier held. Echo restored.', 2.5)
      const t = target()
      if (t) restore(t)
      return
    }
    const p = Transform.has(engine.PlayerEntity) ? Transform.get(engine.PlayerEntity).position : undefined
    if (p && p.y < 1.6 && pointSegmentDistance(v3(p.x, 1.0, p.z), origin, end) <= CORRUPTION.hitRadius) {
      damagePlayer(CORRUPTION.hostileDamage, 'your corrupted echo')
    }
  }, 1.1, CORRUPTION.hostileSpeed)
}

function beam(e: Entity, a: V3, b: V3, width: number) {
  const dir = Vector3.subtract(Vector3.create(b.x, b.y, b.z), Vector3.create(a.x, a.y, a.z))
  const len = Vector3.length(dir)
  if (len < 0.01) return
  const tr = Transform.getMutable(e)
  tr.position = Vector3.lerp(Vector3.create(a.x, a.y, a.z), Vector3.create(b.x, b.y, b.z), 0.5)
  tr.rotation = Quaternion.multiply(Quaternion.lookRotation(Vector3.normalize(dir)), AXIS_FIX)
  tr.scale = Vector3.create(width, len, width)
}

function hideAll() {
  for (const x of [tether, anchor, aimLine]) if (x) Transform.getMutable(x).position = HIDDEN
}

function corruptionVisuals() {
  const e = target()
  if (mode === 'idle' || !e) return hideAll()
  const anchorPos = v3(e.pos.x, CORRUPTION.anchorHeight, e.pos.z)
  const pulse = 1 + 0.25 * Math.sin(state.time * (mode === 'warning' ? 9 : 5))
  const a = Transform.getMutable(anchor)
  a.position = Vector3.create(anchorPos.x, anchorPos.y, anchorPos.z)
  const r = CORRUPTION.anchorRadius * 0.9 * pulse
  a.scale = Vector3.create(r, r, r)
  // Crimson thread from the Watcher's eye to the anchor (wavers while it pulls).
  const eye = watcherEyePosition()
  beam(tether, eye, anchorPos, mode === 'warning' ? 0.06 + 0.03 * Math.sin(state.time * 7) : 0.05)
  if (mode === 'corrupted' && shotStage !== 'flight') {
    beam(aimLine, anchorPos, v3(lockedEnd.x, 1.0, lockedEnd.z), shotStage === 'lock' ? 0.09 : 0.035)
  } else Transform.getMutable(aimLine).position = HIDDEN
}

export function corruptionMode(): Mode {
  return mode
}
