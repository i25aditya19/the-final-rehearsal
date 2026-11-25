// Presentation that only OBSERVES game state:
//  - floating damage numbers above the Watcher (gold for Convergence-sized hits, "DEFLECTED")
//  - the victory sequence around the boss: gold beams from every surviving echo, gold motes
//    filling the chamber, the wall silhouettes released, the clock racing forward
import { BillboardMode, Billboard, Entity, TextShape, Transform, engine } from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import { ARENA, BOSS, COLORS } from '../config'
import { state } from '../game/state'
import { onReset } from '../game/session'
import { spawnTracer } from './tracers'
import { burst, setVictoryMotes } from './vfx'

const POOL = 6
type Num = { e: Entity; until: number; born: number; x: number; z: number; color: Color4 }
const nums: Num[] = []
let cursor = 0
let prevHp: number = BOSS.maxHealth
let prevDeflect = -10
let prevPhase = 'active'
let prevRun = 0
const silhouettes: { e: Entity; y: number; s: number }[] = []

export function initFeedback() {
  for (let i = 0; i < POOL; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, -40, 0) })
    TextShape.create(e, { text: '', fontSize: 6, textColor: Color4.White(), outlineWidth: 0.15, outlineColor: Color3.Black() })
    Billboard.create(e, { billboardMode: BillboardMode.BM_Y })
    nums.push({ e, until: -1, born: 0, x: 0, z: 0, color: Color4.White() })
  }
  for (let i = 0; i < 12; i++) {
    const e = engine.getEntityOrNullByName(`Arena/Silhouette ${i}`)
    if (e && Transform.has(e)) silhouettes.push({ e, y: Transform.get(e).position.y, s: Transform.get(e).scale.x })
  }
  engine.addSystem(feedbackSystem)
  onReset(() => {
    for (const n of nums) {
      n.until = -1
      Transform.getMutable(n.e).position = Vector3.create(0, -40, 0)
    }
    for (const s of silhouettes) {
      const tr = Transform.getMutable(s.e)
      tr.position = Vector3.create(tr.position.x, s.y, tr.position.z)
      tr.scale = Vector3.create(s.s, s.s, s.s)
    }
    setVictoryMotes(false)
  })
}

function popNumber(text: string, color: Color4, size: number) {
  const n = nums[cursor++ % POOL]
  const a = Math.random() * Math.PI * 2
  n.x = ARENA.center.x + Math.sin(a) * 1.2
  n.z = ARENA.center.z + Math.cos(a) * 1.2
  n.born = state.time
  n.until = state.time + 1.1
  n.color = color
  const ts = TextShape.getMutable(n.e)
  ts.text = text
  ts.fontSize = size
  ts.textColor = color
}

function feedbackSystem() {
  const s = state
  if (s.runId !== prevRun) {
    prevRun = s.runId
    prevHp = s.bossHp
    prevDeflect = s.deflectAt
    prevPhase = s.phase
  }
  // Damage numbers
  if (s.bossHp < prevHp - 0.01) {
    const dmg = prevHp - s.bossHp
    const big = dmg >= 12
    popNumber(`-${Math.round(dmg)}`, big ? Color4.fromHexString(COLORS.syncGold) : Color4.fromHexString(COLORS.ivory), big ? 11 : 6)
  }
  prevHp = s.bossHp
  if (s.deflectAt !== prevDeflect) popNumber('DEFLECTED', Color4.fromHexString(COLORS.silver), 4)
  prevDeflect = s.deflectAt
  for (const n of nums) {
    if (n.until < 0) continue
    const k = (s.time - n.born) / (n.until - n.born)
    if (k >= 1) {
      n.until = -1
      Transform.getMutable(n.e).position = Vector3.create(0, -40, 0)
      continue
    }
    Transform.getMutable(n.e).position = Vector3.create(n.x, BOSS.hoverHeight + 3.6 + k * 1.6, n.z)
    TextShape.getMutable(n.e).textColor = Color4.create(n.color.r, n.color.g, n.color.b, 1 - k * k)
  }

  // Victory sequence (the Watcher's own break-up lives in watcher.ts)
  if (s.phase === 'victory' && prevPhase !== 'victory') {
    const bossAt = { x: ARENA.center.x, y: BOSS.hoverHeight + 1, z: ARENA.center.z }
    for (const e of s.echoes) {
      if (e.corrupted) continue
      spawnTracer({ x: e.pos.x, y: 1.4, z: e.pos.z }, bossAt, COLORS.syncGold, true, { width: 0.4, seconds: 2.6, intensity: 8 })
    }
    burst(bossAt, COLORS.syncGold, 2.5)
    setVictoryMotes(true)
  }
  if (s.phase === 'victory') {
    const te = s.time - s.endedAt
    if (te > 2.4) {
      // The trapped sorcerers are released: they rise and fade into the light.
      const k = Math.min(1, (te - 2.4) / 3)
      for (const sl of silhouettes) {
        const tr = Transform.getMutable(sl.e)
        tr.position = Vector3.create(tr.position.x, sl.y + k * 6, tr.position.z)
        const sc = sl.s * (1 - k)
        tr.scale = Vector3.create(sc, sc, sc)
      }
    }
  }
  prevPhase = s.phase
}
