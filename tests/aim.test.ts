import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeShot, resolveShot, sectorOf, segmentCylinderT, HitCylinder } from '../src/combat/aim'
import { headingDeg, headingDiffDeg, norm, v3 } from '../src/math/vec'

const boss: HitCylinder = { center: v3(24, 0, 24), radius: 1.6, yMin: 0, yMax: 6 }
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

test('segment hits cylinder side at the near surface', () => {
  const t = segmentCylinderT(v3(24, 1.3, 14), v3(0, 0, 1), boss, 30)
  assert.ok(t !== null)
  near(t!, 10 - 1.6)
})

test('segment misses when passing beside the cylinder', () => {
  assert.equal(segmentCylinderT(v3(27, 1.3, 14), v3(0, 0, 1), boss, 30), null)
})

test('segment misses when out of range (no tunnelling, no infinite reach)', () => {
  assert.equal(segmentCylinderT(v3(24, 1.3, 14), v3(0, 0, 1), boss, 5), null)
})

test('segment going over the top misses; through the cap hits', () => {
  assert.equal(segmentCylinderT(v3(24, 8, 14), v3(0, 0, 1), boss, 30), null)
  const down = norm(v3(0, -1, 1))
  const t = segmentCylinderT(v3(24, 16, 14), down, boss, 30)
  assert.ok(t !== null, 'should enter through the top cap')
})

test('segment starting inside hits at t=0', () => {
  near(segmentCylinderT(v3(24.5, 1, 24), v3(1, 0, 0), boss, 30)!, 0)
})

test('computeShot: camera behind player aiming at boss hits', () => {
  const r = computeShot({
    castOrigin: v3(24, 1.3, 14),
    cameraPos: v3(24, 2.5, 10.5),
    cameraDir: norm(v3(0, 0.05, 1)),
    target: boss,
    range: 30,
    aimAssistDeg: 6
  })
  assert.equal(r.hit, true)
  assert.ok(r.distance < 10)
})

test('computeShot: aim assist rescues a small horizontal miss', () => {
  // Aiming about 3 m to the side at 10 m (~12 deg off) misses; ~4 deg off is assisted.
  const wide = computeShot({ castOrigin: v3(24, 1.3, 14), cameraPos: v3(24, 1.3, 14), cameraDir: norm(v3(2.2, 0, 10)), target: boss, range: 30, aimAssistDeg: 6 })
  assert.equal(wide.hit, false)
  const close = computeShot({ castOrigin: v3(24, 1.3, 14), cameraPos: v3(24, 1.3, 14), cameraDir: norm(v3(0.7, 0, 10)), target: boss, range: 30, aimAssistDeg: 6 })
  assert.equal(close.hit, true)
})

test('computeShot: aiming at the sky is never assisted', () => {
  const r = computeShot({ castOrigin: v3(24, 1.3, 14), cameraPos: v3(24, 1.3, 14), cameraDir: norm(v3(0, 3, 1)), target: boss, range: 30, aimAssistDeg: 6 })
  assert.equal(r.hit, false)
  assert.equal(r.assisted, false)
})

test('computeShot: aiming away from the boss misses and ends at range', () => {
  const r = computeShot({ castOrigin: v3(24, 1.3, 14), cameraPos: v3(24, 2, 12), cameraDir: v3(0, 0, -1), target: boss, range: 30, aimAssistDeg: 6 })
  assert.equal(r.hit, false)
  near(r.distance, 30)
})

test('resolveShot repeats a fixed direction (echo behaviour)', () => {
  const dir = norm(v3(0, 0, 1))
  assert.equal(resolveShot(v3(24, 1.3, 14), dir, boss, 30).hit, true)
  // Same stored direction from a different position does not home in.
  assert.equal(resolveShot(v3(30, 1.3, 14), dir, boss, 30).hit, false)
})

test('sectors: N/E/S/W around centre', () => {
  const c = v3(24, 0, 24)
  assert.equal(sectorOf(v3(24, 0, 34), c, 4), 0)
  assert.equal(sectorOf(v3(34, 0, 24), c, 4), 1)
  assert.equal(sectorOf(v3(24, 0, 14), c, 4), 2)
  assert.equal(sectorOf(v3(14, 0, 24), c, 4), 3)
})

test('sectors: hysteresis keeps the previous sector near a boundary', () => {
  const c = v3(24, 0, 24)
  // Heading 47 deg: just past the N/E boundary (45 deg).
  const r = (47 * Math.PI) / 180
  const p = v3(24 + Math.sin(r) * 8, 0, 24 + Math.cos(r) * 8)
  assert.equal(sectorOf(p, c, 4), 1)
  assert.equal(sectorOf(p, c, 4, 8, 0), 0)
  // Far past the boundary it switches.
  const r2 = (60 * Math.PI) / 180
  assert.equal(sectorOf(v3(24 + Math.sin(r2) * 8, 0, 24 + Math.cos(r2) * 8), c, 4, 8, 0), 1)
})

test('heading helpers', () => {
  near(headingDeg(v3(0, 0, 1)), 0)
  near(headingDeg(v3(1, 0, 0)), 90)
  near(headingDiffDeg(350, 10), 20)
})

import { stopDistance } from '../src/combat/aim'

test('missed spells stop at the wall or the floor, never beyond range', () => {
  const c = v3(40, 0, 40)
  // From 10 m south of centre flying south: wall (radius 23) is 13 m away.
  near(stopDistance(v3(40, 1.3, 30), v3(0, 0, -1), c, 23, 46), 13)
  // Aiming down hits the floor first.
  near(stopDistance(v3(40, 1.3, 30), norm(v3(0, -1, 1)), c, 23, 46), 1.3 * Math.SQRT2)
  // Range caps it.
  near(stopDistance(v3(40, 1.3, 30), v3(0, 0, -1), c, 23, 5), 5)
})
