// Imprint: left click casts a spell from the caster toward the crosshair.
// M1: direct damage only. M2 adds the echo left behind at the cast position.
import { InputAction, PointerEventType, PointerLock, PrimaryPointerInfo, Transform, engine, inputSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { ARENA, BOSS, COLORS, IMPRINT } from '../config'
import { computeShot, sectorOf } from './aim'
import { bossHitVolume } from '../boss/watcher'
import { spawnTracer } from '../effects/tracers'
import { state } from '../game/state'
import { v3 } from '../math/vec'

let lockRequestedAt = -1
let lockRequestIgnored = false

export function initImprint() {
  if (!PointerLock.has(engine.CameraEntity)) PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })
  engine.addSystem(imprintSystem)
}

function imprintSystem() {
  if (!Transform.has(engine.PlayerEntity) || !Transform.has(engine.CameraEntity)) return
  const player = Transform.get(engine.PlayerEntity).position
  state.playerSector = sectorOf(player, ARENA.center, ARENA.sectorCount, ARENA.sectorHysteresisDeg, state.playerSector < 0 ? undefined : state.playerSector)

  const lock = PointerLock.getOrNull(engine.CameraEntity)
  state.pointerLocked = isMobile() || !lock || lock.isPointerLocked

  // M1 test key: F refills the boss so aiming can be tested repeatedly.
  if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) refillBoss()

  if (!inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) return

  // A click on a free cursor captures it instead of casting (and never fires through UI clicks).
  // Some clients may never report the lock; after one capture request, casting is allowed anyway.
  if (!state.pointerLocked && !lockRequestIgnored) {
    if (lockRequestedAt >= 0 && state.time - lockRequestedAt < 5) {
      lockRequestIgnored = true
      console.log('[FinalRehearsal] client did not report pointer lock; casting with a free cursor')
    } else {
      lockRequestedAt = state.time
      PointerLock.getMutable(engine.CameraEntity).isPointerLocked = true
      return
    }
  }
  if (state.time < state.imprintReadyAt) return
  if (state.bossHp <= 0) return

  const cam = Transform.get(engine.CameraEntity)
  const ray = PrimaryPointerInfo.getOrNull(engine.RootEntity)?.worldRayDirection
  const camDir = ray && (ray.x !== 0 || ray.y !== 0 || ray.z !== 0) ? ray : Vector3.rotate(Vector3.Forward(), cam.rotation)

  const castOrigin = v3(player.x, player.y + IMPRINT.castHeight, player.z)
  const shot = computeShot({
    castOrigin,
    cameraPos: cam.position,
    cameraDir: camDir,
    target: bossHitVolume(),
    range: IMPRINT.range,
    aimAssistDeg: IMPRINT.aimAssistDeg
  })

  state.imprintReadyAt = state.time + IMPRINT.cooldown
  state.shots++
  spawnTracer(castOrigin, shot.end, COLORS.echoCyan, shot.hit)

  if (shot.hit) {
    const dmg = Math.min(IMPRINT.directDamage, state.bossHp)
    state.bossHp -= dmg
    state.hits++
    state.bossFlashUntil = state.time + 0.12
    state.lastShot = { kind: 'hit', damage: dmg, assisted: shot.assisted, at: state.time }
    if (state.bossHp <= 0) console.log('[FinalRehearsal] M1: boss HP reached 0 (victory flow arrives in M3)')
  } else {
    state.lastShot = { kind: 'miss', damage: 0, assisted: false, at: state.time }
  }
}

/** M1 test helper: full boss health again. */
export function refillBoss() {
  state.bossHp = BOSS.maxHealth
}
