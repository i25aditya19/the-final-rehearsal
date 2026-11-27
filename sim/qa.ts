// Functional QA in the real scene code (headless): restarts, post-victory safety, the Convergence
// synchronization charge, the false victory, adaptive behaviour. run: npm run sim:qa
import { InputAction, InputModifier, MainCamera, PointerEventType, PointerEventsResult, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { main } from '../src/index'
import { state, damagePlayer } from '../src/game/state'
import { retry } from '../src/game/session'
import { leaveEcho } from '../src/echoes/echoSystem'
import { attackDebug, debugStartAttack } from '../src/boss/attacks'
import { corruptionDebug } from '../src/boss/corruption'
import { ARENA, BOSS, PHASES, SESSION } from '../src/config'
import { hitBoss } from '../src/game/phases'

const C = ARENA.center
let ts = 1
let tick = 0
const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail })

function setPlayer(x: number, z: number) {
  const p = Transform.getMutableOrNull(engine.PlayerEntity)
  if (p) p.position = Vector3.create(x, ARENA.floorY, z)
  else Transform.create(engine.PlayerEntity, { position: Vector3.create(x, ARENA.floorY, z) })
}
function press(button: InputAction) {
  PointerEventsResult.addValue(engine.RootEntity, { button, state: PointerEventType.PET_DOWN, timestamp: ts++, analog: 1, tickNumber: tick } as any)
}
async function step(sec: number, each?: () => void) {
  for (let i = 0; i < Math.round(sec * 30); i++) {
    each?.()
    tick++
    await engine.update(1 / 30)
  }
}
const dirTo = (x: number, z: number) => Vector3.normalize(Vector3.create(C.x - x, 0, C.z - z))
function echoAt(deg: number, r = 12) {
  const a = (deg * Math.PI) / 180
  const x = C.x + Math.sin(a) * r
  const z = C.z + Math.cos(a) * r
  leaveEcho({ x, y: 0, z }, { x, y: 1.4, z }, dirTo(x, z))
}

async function run() {
  setPlayer(C.x, C.z - 16)
  main()
  await step(2)

  // 1. Ten consecutive restarts at different moments: everything returns to the start state.
  let clean = 0
  const issues: string[] = []
  for (let i = 0; i < 10; i++) {
    echoAt(10 + i * 30)
    echoAt(120 + i * 30)
    await step(3 + i * 2.3) // mid-attack at various points
    retry()
    await step(0.1)
    const dbg = attackDebug()
    const ok = state.bossHp === BOSS.maxHealth && state.playerHp === 100 && state.echoes.length === 0 && !dbg.kind && corruptionDebug().mode === 'idle' && state.bossPhase === 1 && state.stage === 'fight' && state.syncChargeUntil === 0 && state.time < 0.5
    if (ok) clean++
    else issues.push(`restart ${i}: hp ${state.bossHp}/${state.playerHp} echoes ${state.echoes.length} attack ${dbg.kind} corr ${corruptionDebug().mode} t ${state.time.toFixed(2)}`)
  }
  check('10 consecutive restarts reset boss, player, echoes, attacks, corruption, charge, timer', clean === 10, issues.join('; '))
  // and nothing from the old run fires afterwards
  const hp0 = state.playerHp
  await step(10)
  check('no surviving attack timers after restart (first attack waits for its delay)', state.playerHp === hp0 && state.time > 9, `hp ${hp0} -> ${state.playerHp}`)

  // 2. Synchronization charge: two echoes cast 2 s apart (out of phase) -> E aligns, fires together.
  retry()
  await step(0.5)
  echoAt(0)
  await step(2)
  echoAt(90)
  await step(0.6)
  const conv0 = state.convergences
  press(InputAction.IA_PRIMARY)
  await step(0.2)
  const charging = state.syncChargeUntil > state.time
  await step(1.5)
  check('E with two out-of-phase echoes starts a charge and fires a Convergence after it', charging && state.convergences === conv0 + 1, `charging ${charging}, convergences ${conv0} -> ${state.convergences}, hits ${state.lastConvergence?.hits}`)

  // 3. A hit during the charge breaks it (and does not consume the cooldown).
  retry()
  await step(0.5)
  echoAt(0)
  await step(2)
  echoAt(90)
  await step(0.6)
  press(InputAction.IA_PRIMARY)
  await step(0.3)
  const before = state.convergences
  const wasCharging = state.syncChargeUntil > state.time
  state.playerImmuneUntil = 0
  damagePlayer(5, 'qa')
  await step(1.6)
  check('a hit during the charge breaks it; cooldown not consumed', wasCharging && state.convergences === before && state.time >= state.convergenceReadyAt, `charging ${wasCharging}, convergences ${before} -> ${state.convergences}`)

  // 4. False victory before phase III: 6.5 s, formation kept, no damage, then phase III.
  retry()
  await step(0.5)
  echoAt(0)
  echoAt(120)
  echoAt(240)
  state.bossPhase = 2
  state.stage = 'transition'
  state.stageStartedAt = state.time
  const ids = state.echoes.map((e) => e.id).join(',')
  const hp1 = state.playerHp
  await step(SESSION.finalTransitionSeconds - 0.3)
  const stillTransition = state.stage === 'transition'
  await step(0.6)
  check('false victory lasts ~6.5 s, keeps the echo formation, deals no damage, then phase III',
    stillTransition && state.bossPhase === 3 && state.echoes.map((e) => e.id).join(',') === ids && state.playerHp === hp1, `phase ${state.bossPhase} stage ${state.stage} echoes ${ids} -> ${state.echoes.map((e) => e.id).join(',')}`)

  // 5. Nothing damages the player after victory.
  retry()
  await step(14) // let an attack start
  state.playerHp = 100
  ;(await import('../src/game/session')).endRun('boss')
  const hp2 = state.playerHp
  await step(12)
  check('no damage after victory (12 s with attacks mid-flight at the moment of victory)', state.playerHp === hp2 && state.phase === 'victory', `hp ${hp2} -> ${state.playerHp}`)

  // 6. Adaptive: a player standing still is looked at (Gaze chosen) in phase I.
  retry()
  setPlayer(C.x + 3, C.z - 15)
  let gazeFirst = false
  await step(ARENA.playableRadius ? 13 : 13, () => {
    if (attackDebug().kind === 'gaze') gazeFirst = true
  })
  check('a still player draws the Gaze (adaptive)', gazeFirst)

  // 7. Phase III seals and the finale: three qualifying Convergences; the third starts the finale;
  //    his last resistance cannot kill; the finishing attack wins; the timer cannot steal it.
  retry()
  await step(0.3)
  echoAt(0); echoAt(90); echoAt(180)
  state.bossPhase = 3
  state.bossHp = 100
  state.stage = 'fight'
  const seal = () => {
    state.windowOpenUntil = state.time + 5
    state.convergingIds = state.echoes.map((e) => e.id)
    return hitBoss('convergence', 24, { hits: 3, sectors: 3 })
  }
  const s1 = seal()
  await step(0.2)
  const s2 = seal()
  await step(0.2)
  state.playerHp = 4
  state.time = SESSION.hardCapSeconds - 1 // the clock is about to run out
  const s3 = seal()
  const inFinale = state.stage === 'finale' && state.bossHp === 1
  let minHp = state.playerHp
  await step(PHASES.finaleFinishAt + 1.5, () => { minHp = Math.min(minHp, state.playerHp) })
  check('phase III: seal, seal, finale (3 qualifying Convergences, 3 echoes)', s1.seal === 1 && s2.seal === 2 && !!s3.finale && inFinale, `seals ${s1.seal},${s2.seal},${s3.finale} hp-after ${state.bossHp}`)
  check('finale: his last resistance never kills; victory even as the time cap passes', state.phase === 'victory' && minHp >= 1, `phase ${state.phase} minHp ${minHp} formation ${state.finalFormation.length}`)
  check('finale formation captured from the actual echoes', state.finalFormation.length === 3)

  // 8. Temporal Pursuit: it replays the recorded path (locked) and never chases.
  retry()
  await step(0.5)
  state.bossPhase = 2
  for (let i = 0; i <= 40; i++) { setPlayer(C.x - 10 + i * 0.5, C.z - 14); await step(0.1) } // walk 20 m east over 4 s
  setPlayer(C.x, C.z + 15) // then far away, off the path
  debugStartAttack('pursuit')
  const hpA = state.playerHp
  await step(7)
  check('pursuit: afterimage walks the locked path and never chases (player off the path is safe)', state.playerHp === hpA && !attackDebug().kind, `hp ${hpA} -> ${state.playerHp}`)
  // stand in the middle of the recorded path: hit once, never twice
  for (let i = 0; i <= 40; i++) { setPlayer(C.x - 10 + i * 0.5, C.z - 14); await step(0.1) }
  setPlayer(C.x - 0.0, C.z - 14)
  debugStartAttack('pursuit')
  const hpB = state.playerHp
  await step(7)
  check('pursuit: standing on the path is hit exactly once (8)', hpB - state.playerHp === 8, `hp ${hpB} -> ${state.playerHp}`)

  // 9. Endings: defeat knocks the avatar out, holds movement, shatters echoes, then releases;
  //    victory strikes the Victory pose and releases the echoes as light.
  const RA = require('~system/RestrictedActions')
  retry()
  await step(0.5)
  echoAt(0); echoAt(90)
  RA.emotes.length = 0
  state.playerImmuneUntil = 0
  damagePlayer(999, 'qa')
  await step(1)
  const heldDuring = InputModifier.has(engine.PlayerEntity)
  const shattered = state.echoes.length === 0
  await step(2.2)
  check('defeat: knockOut emote, movement held then released, echoes shatter', RA.emotes.includes('knockOut') && heldDuring && shattered && !InputModifier.has(engine.PlayerEntity), `emotes ${RA.emotes} held ${heldDuring} shattered ${shattered}`)
  retry()
  await step(0.5)
  echoAt(0); echoAt(120); echoAt(240)
  RA.emotes.length = 0
  ;(await import('../src/game/session')).endRun('boss')
  await step(3.2)
  const released = state.echoes.length === 0
  const camBound = MainCamera.getOrNull(engine.CameraEntity)?.virtualCameraEntity !== undefined
  let outOfBounds = 0
  let maxY = 0
  await step(12.8, () => {
    const vc = MainCamera.getOrNull(engine.CameraEntity)?.virtualCameraEntity
    if (vc !== undefined) {
      const p = Transform.get(vc as any).position
      maxY = Math.max(maxY, p.y)
      if (p.x < 0 || p.x > 80 || p.z < 0 || p.z > 80) outOfBounds++
    }
  })
  const camAfter = MainCamera.getOrNull(engine.CameraEntity)?.virtualCameraEntity
  check('victory: Victory pose, echoes released as light, cinematic camera bound', RA.emotes.includes('Victory') && released && camBound, `emotes ${RA.emotes} released ${released} cam ${camBound}`)
  check('victory cinematic: stays inside the scene, rises above the dome, releases the camera and movement', outOfBounds === 0 && maxY > 36 && camAfter === undefined && !InputModifier.has(engine.PlayerEntity), `oob ${outOfBounds} maxY ${maxY.toFixed(1)} camAfter ${camAfter}`)
  // skip with E
  retry()
  await step(0.5)
  ;(await import('../src/game/session')).endRun('boss')
  await step(3.5)
  press(InputAction.IA_PRIMARY)
  await step(0.6)
  check('victory cinematic: E skips to the results', state.cinematicSkipAt > 0 && MainCamera.getOrNull(engine.CameraEntity)?.virtualCameraEntity === undefined && !InputModifier.has(engine.PlayerEntity))
  retry()
  await step(0.2)
  check('retry after an ending leaves no movement hold', !InputModifier.has(engine.PlayerEntity))

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  [${r.detail}]` : ''}`)
  console.log(`QA ${results.filter((r) => r.ok).length}/${results.length} passed`)
}
run()
