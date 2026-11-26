import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseAdaptive, extraRecovery, Signals } from '../src/boss/adaptive'

const base: Signals = { recentTravel: 10, friendlyEchoes: 1, echoSectors: 1, recentHits: 0, corruptionReady: true }
const P2 = ['stolen', 'gaze', 'blindspot', 'volley', 'aftershock'] as const

test('no adaptation when nothing stands out', () => {
  assert.equal(chooseAdaptive(base, [...P2], [], false), undefined)
})
test('standing still invites the Gaze', () => {
  assert.equal(chooseAdaptive({ ...base, recentTravel: 1 }, [...P2], [], false)?.kind, 'gaze')
})
test('echoes stacked in one sector invite the Blind Spot', () => {
  assert.equal(chooseAdaptive({ ...base, friendlyEchoes: 3, echoSectors: 1 }, [...P2], [], false)?.kind, 'blindspot')
})
test('a strong spread formation invites the Stolen Moment, only if corruption is ready', () => {
  const s = { ...base, friendlyEchoes: 3, echoSectors: 3 }
  assert.equal(chooseAdaptive(s, [...P2], [], false)?.kind, 'stolen')
  assert.equal(chooseAdaptive({ ...s, corruptionReady: false }, [...P2], [], false), undefined)
})
test('only attacks the phase allows (phase I has no Blind Spot or Stolen Moment)', () => {
  const s = { ...base, friendlyEchoes: 3, echoSectors: 1, recentTravel: 0 }
  assert.equal(chooseAdaptive(s, ['gaze', 'aftershock'], [], false)?.kind, 'gaze')
  assert.equal(chooseAdaptive({ ...s, recentTravel: 9 }, ['gaze', 'aftershock'], [], false), undefined)
})
test('never adapts twice in a row, never a third identical attack', () => {
  const still = { ...base, recentTravel: 0 }
  assert.equal(chooseAdaptive(still, [...P2], [], true), undefined)
  assert.equal(chooseAdaptive(still, [...P2], ['gaze', 'gaze'], false), undefined)
})
test('repeated hits earn extra recovery', () => {
  assert.equal(extraRecovery({ ...base, recentHits: 2 }) > 0, true)
  assert.equal(extraRecovery(base), 0)
})
