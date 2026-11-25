import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Echo, EchoRules, convergenceDamage, firstFireTime, oldestReplaceable, placeEcho, readyGroup, scheduleNext } from '../src/echoes/echoLogic'
import { v3 } from '../src/math/vec'

const rules: EchoRules = { maxSlots: 4, minSeparation: 2, repeatInterval: 4, phaseSnap: 2, minFirstDelay: 2, playableRadius: 12, center: v3(24, 0, 24) }
const noSnap: EchoRules = { ...rules, phaseSnap: 0 }
const dir = v3(0, 0, 1)

function make() {
  let id = 0
  const echoes: Echo[] = []
  const place = (x: number, z: number, now: number, r = rules) => placeEcho(echoes, v3(x, 0, z), v3(x, 1.3, z), dir, now, r, () => ++id)
  return { echoes, place }
}

test('first echo repeats exactly 4 s after the cast', () => {
  const { echoes, place } = make()
  const r = place(24, 14, 10)
  assert.equal(r.kind, 'new')
  assert.equal(echoes[0].nextFire, 14)
})

test('casting near an existing echo refreshes it instead of adding one', () => {
  const { echoes, place } = make()
  place(24, 14, 0, noSnap)
  const r = place(25, 14.5, 3, noSnap)
  assert.equal(r.kind, 'refresh')
  assert.equal(echoes.length, 1)
  assert.equal(echoes[0].nextFire, 7)
  assert.equal(echoes[0].pos.x, 25)
})

test('echo slots cap at four; the fifth replaces the oldest', () => {
  const { echoes, place } = make()
  place(24, 14, 0)
  place(34, 24, 1)
  place(24, 34, 2)
  place(14, 24, 3)
  assert.equal(echoes.length, 4)
  const firstId = echoes[0].id
  const r = place(20, 20, 4)
  assert.equal(r.kind, 'replace')
  assert.equal(echoes.length, 4)
  assert.ok(!echoes.some((e) => e.id === firstId))
})

test('a refreshed echo is no longer the oldest', () => {
  const { echoes, place } = make()
  place(24, 14, 0)
  place(34, 24, 1)
  place(24.5, 14.5, 2) // refresh the first
  assert.equal(oldestReplaceable(echoes)!.pos.x, 34)
})

test('corrupted echoes are never replaced or refreshed away', () => {
  const { echoes, place } = make()
  place(24, 14, 0)
  place(34, 24, 1)
  place(24, 34, 2)
  place(14, 24, 3)
  echoes[0].corrupted = true
  const r = place(20, 20, 4)
  assert.equal(r.kind, 'replace')
  assert.ok(echoes.some((e) => e.corrupted), 'corrupted echo survives')
  const near = place(24.3, 14.2, 5)
  assert.equal(near.kind, 'full')
  for (const e of echoes) e.corrupted = true
  assert.equal(place(30, 30, 6).kind, 'full')
})

test('echoes cannot form outside the engraved floor', () => {
  const { echoes, place } = make()
  const r = place(24, 24 + 12.5, 0)
  assert.equal(r.kind, 'invalid')
  assert.equal(echoes.length, 0)
})

test('phase snapping: a burst of casts 1 s apart shares one beat', () => {
  const { echoes, place } = make()
  place(24, 14, 0) // fires at 4
  place(34, 24, 1) // natural 5 -> snaps to 4? no: must be >= 1+2=3, 4 ok
  place(24, 34, 2) // natural 6 -> 4 is within 2 and >= 4
  place(14, 24, 3) // natural 7 -> 8 (4 is too soon: < 3+2)
  assert.deepEqual(echoes.map((e) => e.nextFire), [4, 4, 4, 8])
  // All four share the same phase modulo the interval.
  assert.ok(echoes.every((e) => e.nextFire % 4 === 0))
})

test('phase snapping off: echoes keep their natural times', () => {
  const { echoes, place } = make()
  place(24, 14, 0, noSnap)
  place(34, 24, 1, noSnap)
  assert.deepEqual(echoes.map((e) => e.nextFire), [4, 5])
})

test('firstFireTime never fires sooner than the minimum delay', () => {
  const echoes: Echo[] = [{ id: 1, pos: v3(0, 0, 0), origin: v3(0, 0, 0), dir, nextFire: 10.5, placedAt: 0, corrupted: false, lastFired: -1 }]
  assert.ok(firstFireTime(echoes, 10, rules) >= 12)
})

test('ready group: only friendly echoes due within the window', () => {
  const base = { pos: v3(0, 0, 0), origin: v3(0, 0, 0), dir, placedAt: 0, corrupted: false, lastFired: -1 }
  const echoes: Echo[] = [
    { ...base, id: 1, nextFire: 10.5 },
    { ...base, id: 2, nextFire: 10.9 },
    { ...base, id: 3, nextFire: 12 },
    { ...base, id: 4, nextFire: 10.2, corrupted: true }
  ]
  assert.deepEqual(readyGroup(echoes, 10, 1).map((e) => e.id), [1, 2])
})

test('convergence damage replaces echo damage: 2/3/4 -> 12/24/40', () => {
  const table = { 2: 12, 3: 24, 4: 40 }
  assert.equal(convergenceDamage(0, table, 3), 0)
  assert.equal(convergenceDamage(1, table, 3), 3)
  assert.equal(convergenceDamage(2, table, 3), 12)
  assert.equal(convergenceDamage(3, table, 3), 24)
  assert.equal(convergenceDamage(4, table, 3), 40)
})

test('scheduleNext does not burst after a long hitch', () => {
  const e: Echo = { id: 1, pos: v3(0, 0, 0), origin: v3(0, 0, 0), dir, nextFire: 4, placedAt: 0, corrupted: false, lastFired: -1 }
  scheduleNext(e, 4.01, 4)
  assert.equal(e.nextFire, 8)
  scheduleNext(e, 20, 4)
  assert.equal(e.nextFire, 24)
})
