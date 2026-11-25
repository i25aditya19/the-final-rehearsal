import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gapLayout, inCone, inGap, ringSweptHits, RingWave } from '../src/combat/attackMath'
import { v3 } from '../src/math/vec'

const c = v3(24, 0, 24)

test('Gaze cone: inside, outside by angle, outside by range', () => {
  // Cone facing south (180 deg), 38 deg wide.
  assert.equal(inCone(v3(24, 0, 16), c, 180, 38, 15), true)
  assert.equal(inCone(v3(26.5, 0, 16), c, 180, 38, 15), true) // ~17 deg off
  assert.equal(inCone(v3(28, 0, 16), c, 180, 38, 15), false) // ~27 deg off
  assert.equal(inCone(v3(24, 0, 8), c, 180, 38, 15), false) // 16 m away
})

test('Gaze cone handles headings across 0/360', () => {
  assert.equal(inCone(v3(23, 0, 34), c, 355, 38, 15), true)
})

test('gaps: inside and outside, wrap-around', () => {
  assert.equal(inGap(10, [350], 50), true)
  assert.equal(inGap(30, [350], 50), false)
})

const wave = (radius: number, gaps: number[] = []): RingWave => ({ center: c, radius, bandWidth: 0.9, gapCenters: gaps, gapDeg: 50, jumpClear: 0.45 })

test('ring wave hits a grounded player as it passes', () => {
  assert.equal(ringSweptHits(v3(24, 0, 16), wave(8), 7.9), true)
  assert.equal(ringSweptHits(v3(24, 0, 16), wave(5), 4.9), false)
})

test('ring wave is swept: a big frame step cannot skip the player', () => {
  assert.equal(ringSweptHits(v3(24, 0, 16), wave(10), 6), true)
})

test('ring wave: jumping clears it, standing in a gap avoids it', () => {
  assert.equal(ringSweptHits(v3(24, 0.8, 16), wave(8), 7.9), false)
  assert.equal(ringSweptHits(v3(24, 0, 16), wave(8, [180]), 7.9), false)
})

test('gap layout spreads gaps from an offset', () => {
  assert.deepEqual(gapLayout(350, 2, 40), [30, 210])
})

import { pointSegmentDistance } from '../src/combat/aim'

test('volley bolt sweep hits a player it passes through, misses one between lines', () => {
  // bolt moving from (40,1.15,30) to (40,1.15,29.7) this frame
  const a = v3(40, 1.15, 30)
  const b = v3(40, 1.15, 29.7)
  assert.ok(pointSegmentDistance(v3(40, 1.15, 29.8), a, b) <= 0.75)
  assert.ok(pointSegmentDistance(v3(42, 1.15, 29.8), a, b) > 0.75)
})
