// Imprint: left click casts a spell from the caster toward the crosshair.
// M1: direct damage only. M2 adds the echo left behind at the cast position.
import { InputAction, PointerEventType, PointerLock, PrimaryPointerInfo, Transform, engine, inputSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { ARENA, BOSS, COLORS, IMPRINT, UI } from '../config'
import { computeShot, sectorOf, segmentSphereT } from './aim'
import { bossHitVolume } from '../boss/watcher'
import { launch } from '../effects/projectiles'
import { isActive, state } from '../game/state'
import { hitBoss } from '../game/phases'
import { corruptionAnchor, strikeAnchor } from '../boss/corruption'
import { leaveEcho } from '../echoes/echoSystem'
import { v3 } from '../math/vec'

const ARENA_BOUNDS = { center: ARENA.center, wallRadius: ARENA.playableRadius + ARENA.borderMargin }

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

  if (!isActive()) return
  // Debug key: F refills the boss so aiming can be tested repeatedly.
  if (UI.showDebug && inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) refillBoss()
  // Ignore the click that pressed Retry.
  if (state.time < 0.4) return

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
    aimAssistDeg: IMPRINT.aimAssistDeg,
    bounds: ARENA_BOUNDS
  })

  state.imprintReadyAt = state.time + IMPRINT.cooldown
  state.shots++

  // A Stolen Moment's anchor takes priority over the boss; such casts leave no echo.
  const anchor = corruptionAnchor()
  if (anchor) {
    const tA = segmentSphereT(castOrigin, shot.dir, anchor.center, anchor.radius, IMPRINT.range)
    if (tA !== null && (!shot.hit || tA <= shot.distance + 0.01)) {
      const at = { x: castOrigin.x + shot.dir.x * tA, y: castOrigin.y + shot.dir.y * tA, z: castOrigin.z + shot.dir.z * tA }
      launch(castOrigin, at, COLORS.echoCyan, true, () => strikeAnchor())
      return
    }
  }

  const assisted = shot.assisted
  launch(castOrigin, shot.end, COLORS.echoCyan, shot.hit, () => {
    if (shot.hit) {
      const out = hitBoss('direct', IMPRINT.directDamage, undefined, shot.end)
      state.hits++
      state.lastShot = { kind: 'hit', damage: out.damage, assisted, at: state.time }
    } else {
      state.lastShot = { kind: 'miss', damage: 0, assisted: false, at: state.time }
    }
  })

  // Every cast leaves an echo where the caster stood, remembering this exact direction.
  leaveEcho(v3(player.x, player.y, player.z), castOrigin, shot.dir)
}

/** M1 test helper: full boss health again. */
export function refillBoss() {
  state.bossHp = BOSS.maxHealth
}
