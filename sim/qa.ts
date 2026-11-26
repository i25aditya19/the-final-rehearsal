// Functional QA in the real scene code (headless): restarts, post-victory safety, the Convergence
// synchronization charge, the false victory, adaptive behaviour. run: npm run sim:qa
import { InputAction, PointerEventType, PointerEventsResult, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { main } from '../src/index'
import { state, damagePlayer } from '../src/game/state'
import { retry } from '../src/game/session'
import { leaveEcho } from '../src/echoes/echoSystem'
import { attackDebug } from '../src/boss/attacks'
import { corruptionDebug } from '../src/boss/corruption'
import { ARENA, BOSS, SESSION } from '../src/config'

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

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  [${r.detail}]` : ''}`)
  console.log(`QA ${results.filter((r) => r.ok).length}/${results.length} passed`)
}
run()
