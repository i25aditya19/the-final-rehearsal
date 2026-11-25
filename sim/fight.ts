// Headless playtest: runs the REAL scene code (src/index.ts main + all systems) in Node with a
// scripted bot that sees the same telegraphs a player sees, moves at a fixed speed with a reaction
// delay, aims with error, casts, places echoes and presses E. Used to check pacing and fairness.
// run: NODE_PATH=sim/node_path npx tsx sim/fight.ts [runs]
import { InputAction, PointerEventType, PointerEventsResult, PointerLock, PrimaryPointerInfo, Transform, engine } from '@dcl/sdk/ecs'
import { main } from '../src/index'
import { state } from '../src/game/state'
import { ARENA, ATTACKS, BOSS, CONVERGENCE, CORRUPTION, IMPRINT } from '../src/config'
import { attackDebug } from '../src/boss/attacks'
import { corruptionAnchor, corruptionDebug } from '../src/boss/corruption'
import { readyGroup } from '../src/echoes/echoLogic'
import { sectorOf } from '../src/combat/aim'
import { retry } from '../src/game/session'

type Profile = { name: string; speed: number; reaction: number; aimErrDeg: number; dodgeSkill: number }
const PROFILES: Profile[] = [
  { name: 'novice', speed: 5.0, reaction: 0.55, aimErrDeg: 5, dodgeSkill: 0.6 },
  { name: 'average', speed: 5.5, reaction: 0.4, aimErrDeg: 3, dodgeSkill: 0.8 },
  { name: 'skilled', speed: 6.0, reaction: 0.25, aimErrDeg: 1.5, dodgeSkill: 0.95 }
]

const C = ARENA.center
const DT = 1 / 30
let ts = 1
let tick = 0
let rnd = 1
const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
const deg = (r: number) => (r * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180
const headingOf = (x: number, z: number) => (deg(Math.atan2(x - C.x, z - C.z)) + 360) % 360
const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180

function press(button: InputAction) {
  PointerEventsResult.addValue(engine.RootEntity, { button, state: PointerEventType.PET_DOWN, timestamp: ts++, analog: 1, tickNumber: tick } as any)
}

type Result = { profile: string; seed: number; outcome: string; time: number; phase: number; hits: Record<string, number>; conv: number; fourWay: number; redirects: number; grade?: string; phaseTimes: number[] }

async function runOne(p: Profile, seed: number): Promise<Result> {
  rnd = seed * 7919 + 13
  retry()
  let pos = { x: C.x + (rand() - 0.5) * 2, z: C.z - 16.5 }
  const hits: Record<string, number> = {}
  let lastHp = state.playerHp
  let seenAttackAt = -1
  let seenKind: string | undefined
  const phaseTimes: number[] = []
  let lastPhase = 1
  const spots = [0, 90, 180, 270].map((h) => ({ h, x: C.x + Math.sin(rad(h)) * 11, z: C.z + Math.cos(rad(h)) * 11 }))
  let spotIdx = 2 // start south

  while (state.phase === 'active' && state.time < 320) {
    tick++
    const t = state.time
    const dbg = attackDebug()
    if (dbg.kind !== seenKind) {
      seenKind = dbg.kind
      seenAttackAt = t
    }
    const noticed = dbg.kind && t - seenAttackAt >= p.reaction && rand() < p.dodgeSkill + (1 - p.dodgeSkill) * 0.5
    let target: { x: number; z: number } | undefined
    const myH = headingOf(pos.x, pos.z)
    const myR = Math.hypot(pos.x - C.x, pos.z - C.z)

    // ---- react to telegraphs (what the floor shows)
    if (noticed && dbg.kind === 'gaze') {
      const off = angDiff(myH, dbg.gazeHeading)
      if (Math.abs(off) < ATTACKS.gaze.coneDeg / 2 + 8) {
        const side = off >= 0 ? 1 : -1
        const h = myH + side * 40
        target = { x: C.x + Math.sin(rad(h)) * myR, z: C.z + Math.cos(rad(h)) * myR }
      }
    } else if (noticed && dbg.kind === 'aftershock') {
      const w = dbg.waves.find((x) => !x.done && t >= x.warnAt)
      if (w && w.gaps.length) {
        const g = w.gaps.reduce((a, b) => (Math.abs(angDiff(myH, a)) < Math.abs(angDiff(myH, b)) ? a : b))
        const r = Math.max(myR, 9)
        target = { x: C.x + Math.sin(rad(g)) * r, z: C.z + Math.cos(rad(g)) * r }
      }
    } else if (noticed && dbg.kind === 'volley') {
      // keep strafing around the boss to slip between bolt lines
      const h = myH + 25
      target = { x: C.x + Math.sin(rad(h)) * myR, z: C.z + Math.cos(rad(h)) * myR }
    } else if (noticed && dbg.kind === 'blindspot' && t - dbg.startedAt < ATTACKS.blindSpot.warning + 0.2) {
      const h = dbg.safeQuadrant * 90
      target = { x: C.x + Math.sin(rad(h)) * 11, z: C.z + Math.cos(rad(h)) * 11 }
    } else if (noticed && dbg.kind === 'observation' && dbg.safeCircles.length && t - dbg.startedAt < ATTACKS.finalObservation.warning + 0.2) {
      target = dbg.safeCircles.reduce((a, b) => (Math.hypot(a.x - pos.x, a.z - pos.z) < Math.hypot(b.x - pos.x, b.z - pos.z) ? a : b))
    }

    // ---- formation plan: keep one echo at each cardinal spot
    const friendly = state.echoes.filter((e) => !e.corrupted)
    const covered = spots.map((s) => friendly.some((e) => Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 3))
    if (!target) {
      if (covered.every(Boolean)) {
        // full formation: stand by the nearest spot (in a phase II blind spot, the safe one)
        spotIdx = spots.reduce((bi, s, i) => (Math.hypot(s.x - pos.x, s.z - pos.z) < Math.hypot(spots[bi].x - pos.x, spots[bi].z - pos.z) ? i : bi), 0)
      } else if (covered[spotIdx]) {
        // nearest uncovered spot
        let best = -1
        let bd = 1e9
        spots.forEach((s, i) => {
          if (covered[i]) return
          const d = Math.hypot(s.x - pos.x, s.z - pos.z)
          if (d < bd) {
            bd = d
            best = i
          }
        })
        if (best >= 0) spotIdx = best
      }
      target = spots[spotIdx]
    }

    // ---- move
    const dx = target.x - pos.x
    const dz = target.z - pos.z
    const dist = Math.hypot(dx, dz)
    const step = Math.min(dist, p.speed * DT)
    if (dist > 0.01) {
      pos.x += (dx / dist) * step
      pos.z += (dz / dist) * step
    }
    // the low wall / boss blocker
    const rr = Math.hypot(pos.x - C.x, pos.z - C.z)
    if (rr > ARENA.playableRadius + 2.5 || rr < 1.2) {
      const k = (rr > 1.2 ? ARENA.playableRadius + 2.5 : 1.2) / rr
      pos.x = C.x + (pos.x - C.x) * k
      pos.z = C.z + (pos.z - C.z) * k
    }

    // ---- aim (anchor first during a Stolen Moment, else the boss) with error
    const anchor = corruptionAnchor()
    const aimAt = anchor && rand() < p.dodgeSkill ? anchor.center : { x: C.x, y: BOSS.hoverHeight, z: C.z }
    const cam = { x: pos.x, y: 1.7, z: pos.z }
    let ax = aimAt.x - cam.x
    let ay = aimAt.y - cam.y
    let az = aimAt.z - cam.z
    const err = rad((rand() * 2 - 1) * p.aimErrDeg)
    const cx = Math.cos(err)
    const sx = Math.sin(err)
    ;[ax, az] = [ax * cx - az * sx, ax * sx + az * cx]
    const l = Math.hypot(ax, ay, az)
    Transform.createOrReplace(engine.PlayerEntity, { position: { x: pos.x, y: 0, z: pos.z } })
    Transform.createOrReplace(engine.CameraEntity, { position: cam })
    PrimaryPointerInfo.createOrReplace(engine.RootEntity, { worldRayDirection: { x: ax / l, y: ay / l, z: az / l } } as any)
    PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: true })

    // ---- cast whenever ready and roughly in place (or when shooting an anchor)
    const atSpot = Math.hypot(target.x - pos.x, target.z - pos.z) < 1.5
    if (t >= state.imprintReadyAt && (atSpot || anchor) && t > 0.5) press(InputAction.IA_POINTER)

    // ---- Convergence when the runes are gold and it would count
    const ready = readyGroup(state.echoes, t, CONVERGENCE.readyWindow)
    const sectors = new Set(ready.map((e) => sectorOf(e.pos, C, 4))).size
    const need = state.stage === 'gate' ? (state.bossPhase === 1 ? 2 : 3) : state.bossPhase === 3 ? 3 : 2
    const wantSectors = state.bossPhase >= 2 && (state.stage === 'gate' || state.bossPhase === 3) ? 3 : 1
    const windowOk = state.bossPhase < 3 || state.stage === 'gate' || t < state.windowOpenUntil
    if (t >= state.convergenceReadyAt && ready.length >= need && sectors >= wantSectors && windowOk) press(InputAction.IA_PRIMARY)

    await engine.update(DT)

    if (state.playerHp < lastHp) {
      hits[state.lastHitBy] = (hits[state.lastHitBy] ?? 0) + (lastHp - state.playerHp)
    }
    lastHp = state.playerHp
    if (state.bossPhase !== lastPhase) {
      phaseTimes.push(Math.round(state.time))
      lastPhase = state.bossPhase
    }
  }
  return {
    profile: p.name, seed, outcome: state.phase === 'active' ? 'timeout(sim)' : state.endReason ?? state.phase, time: Math.round(state.endedAt || state.time),
    phase: state.bossPhase, hits, conv: state.convergences, fourWay: state.fourWay, redirects: state.redirects, grade: state.score?.grade, phaseTimes
  }
}

async function run() {
  const runs = Number(process.argv[2] ?? 6)
  main()
  for (let i = 0; i < 5; i++) await engine.update(DT)
  const all: Result[] = []
  for (const p of PROFILES) {
    for (let s = 1; s <= runs; s++) {
      const r = await runOne(p, s)
      all.push(r)
      console.log(JSON.stringify(r))
    }
  }
  for (const p of PROFILES) {
    const rs = all.filter((r) => r.profile === p.name)
    const wins = rs.filter((r) => r.outcome === 'boss')
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
    const dmg: Record<string, number> = {}
    for (const r of rs) for (const [k, v] of Object.entries(r.hits)) dmg[k] = (dmg[k] ?? 0) + v / rs.length
    console.log(`SUMMARY ${p.name}: wins ${wins.length}/${rs.length}, avg win time ${avg(wins.map((w) => w.time))}s, phases reached ${rs.map((r) => r.phase).join(',')}, avg damage taken by source ${JSON.stringify(Object.fromEntries(Object.entries(dmg).map(([k, v]) => [k, Math.round(v)])))}`)
  }
  void IMPRINT
  void CORRUPTION
  void corruptionDebug
}
run().catch((e) => {
  console.error(e)
  process.exit(1)
})
