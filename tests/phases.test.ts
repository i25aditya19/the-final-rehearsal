import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BossCtx, masteryScore, phaseFloor, resolveBossDamage } from '../src/game/phaseRules'

const rules = { phaseHealth: 100, phase2OrdinaryMultiplier: 0.25, phase2GateSectors: 3, phase3MinSectors: 3, phase3MinEchoes: 3, phase3SealDamage: 34 }
const ctx = (o: Partial<BossCtx>): BossCtx => ({ phase: 1, stage: 'fight', hp: 300, vulnerable: false, windowOpen: false, ...o })

test('phase floors are 200 / 100 / 0', () => {
  assert.deepEqual([phaseFloor(1, rules), phaseFloor(2, rules), phaseFloor(3, rules)], [200, 100, 0])
})

test('phase I: damage clamps at 200 and raises the gate', () => {
  const r = resolveBossDamage(ctx({ hp: 203 }), 'direct', 5, rules)
  assert.equal(r.damage, 3)
  assert.equal(r.reachedFloor, true)
})

test('gate: ordinary hits deflect; only a 2-echo Convergence breaks gate I, with no carry-over', () => {
  const g = ctx({ hp: 200, stage: 'gate' })
  assert.equal(resolveBossDamage(g, 'direct', 5, rules).deflected, true)
  assert.equal(resolveBossDamage(g, 'convergence', 3, rules, { hits: 1, sectors: 1 }).gateBroken, false)
  const ok = resolveBossDamage(g, 'convergence', 12, rules, { hits: 2, sectors: 1 })
  assert.equal(ok.gateBroken, true)
  assert.equal(ok.damage, 0)
})

test('phase II: ordinary damage is quartered unless the Blind Spot exposes him', () => {
  assert.equal(resolveBossDamage(ctx({ phase: 2, hp: 200 }), 'direct', 5, rules).damage, 1.25)
  assert.equal(resolveBossDamage(ctx({ phase: 2, hp: 200, vulnerable: true }), 'direct', 5, rules).damage, 5)
  assert.equal(resolveBossDamage(ctx({ phase: 2, hp: 200 }), 'convergence', 24, rules, { hits: 3, sectors: 1 }).damage, 24)
})

test('gate II needs three echoes in three sectors', () => {
  const g = ctx({ phase: 2, hp: 100, stage: 'gate' })
  assert.equal(resolveBossDamage(g, 'convergence', 24, rules, { hits: 3, sectors: 2 }).gateBroken, false)
  assert.equal(resolveBossDamage(g, 'convergence', 24, rules, { hits: 3, sectors: 3 }).gateBroken, true)
})

test('phase III barrier: only a qualifying Convergence during an opening, redirects never', () => {
  const closed = ctx({ phase: 3, hp: 100 })
  const open = ctx({ phase: 3, hp: 100, windowOpen: true })
  assert.equal(resolveBossDamage(open, 'direct', 5, rules).deflected, true)
  assert.equal(resolveBossDamage(open, 'redirect', 15, rules).deflected, true)
  assert.equal(resolveBossDamage(closed, 'convergence', 24, rules, { hits: 3, sectors: 3 }).deflected, true)
  assert.equal(resolveBossDamage(open, 'convergence', 24, rules, { hits: 3, sectors: 2 }).deflected, true)
  const a = resolveBossDamage(open, 'convergence', 24, rules, { hits: 3, sectors: 3 })
  assert.equal(a.damage, 34)
  assert.equal(a.seal, 1)
})

test('phase III seals: three qualifying Convergences, same for 3 or 4 echoes; the third starts the finale', () => {
  const b = resolveBossDamage(ctx({ phase: 3, hp: 66, windowOpen: true }), 'convergence', 40, rules, { hits: 4, sectors: 4 })
  assert.equal(b.damage, 34)
  assert.equal(b.seal, 2)
  const c = resolveBossDamage(ctx({ phase: 3, hp: 32, windowOpen: true }), 'convergence', 24, rules, { hits: 3, sectors: 3 })
  assert.equal(c.finale, true)
  assert.equal(c.damage, 31) // holds at 1 HP: the finishing attack ends him
  assert.equal(resolveBossDamage(ctx({ phase: 3, hp: 1, stage: 'finale', windowOpen: true }), 'convergence', 40, rules, { hits: 4, sectors: 4 }).damage, 0)
})

test('transition: no damage at all', () => {
  assert.equal(resolveBossDamage(ctx({ stage: 'transition' }), 'convergence', 40, rules, { hits: 4, sectors: 4 }).damage, 0)
})

test('mastery score and grades', () => {
  const best = masteryScore(120, 100, 4, 2)
  assert.equal(best.total, 3000 + 3000 + 3000 + 1000)
  assert.equal(best.grade, 'S')
  assert.equal(masteryScore(285, 10, 0, 0).grade, 'C')
})
