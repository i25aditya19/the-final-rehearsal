// M1 HUD: boss name + segmented health bar, Imprint readiness, crosshair, contextual hint, debug.
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { BOSS, COLORS, IMPRINT, UI } from '../config'
import { state } from '../game/state'

const c = (hex: string, a = 1) => {
  const k = Color4.fromHexString(hex)
  return Color4.create(k.r, k.g, k.b, a)
}
const PANEL = Color4.create(0.04, 0.04, 0.04, 0.72)
const SECTORS = ['North', 'East', 'South', 'West']

export function setupHud() {
  ReactEcsRenderer.setUiRenderer(Hud)
}

function Hud() {
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      <BossBar />
      <ImprintIndicator />
      {UI.showCrosshair && state.pointerLocked ? <Crosshair /> : null}
      <Hint />
      {UI.showDebug ? <Debug /> : null}
    </UiEntity>
  )
}

function BossBar() {
  const segW = 150
  const perSeg = BOSS.phaseHealth
  const segs = [0, 1, 2].map((i) => {
    // Segment 0 is the last phase (leftmost drains last).
    const segHp = Math.max(0, Math.min(perSeg, state.bossHp - i * perSeg))
    return segHp / perSeg
  })
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 18, left: '50%' }, margin: { left: -250 }, width: 500, height: 64, flexDirection: 'column', alignItems: 'center', padding: 6 }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity
        uiTransform={{ width: '100%', height: 26 }}
        uiText={{ value: `THE WATCHER  ·  ${Math.ceil(state.bossHp)} / ${BOSS.maxHealth}`, fontSize: 16, color: c(COLORS.ivory) }}
      />
      <UiEntity uiTransform={{ width: segW * 3 + 12, height: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        {segs.map((fill, i) => (
          <UiEntity key={`seg${i}`} uiTransform={{ width: segW, height: 14 }} uiBackground={{ color: c(COLORS.charcoal) }}>
            <UiEntity uiTransform={{ width: `${Math.round(fill * 100)}%`, height: '100%' }} uiBackground={{ color: c(state.time < state.bossFlashUntil ? COLORS.finalWhite : COLORS.ash) }} />
          </UiEntity>
        ))}
      </UiEntity>
    </UiEntity>
  )
}

function ImprintIndicator() {
  const remaining = Math.max(0, state.imprintReadyAt - state.time)
  const ready = remaining <= 0
  const pct = ready ? 100 : Math.round((1 - remaining / IMPRINT.cooldown) * 100)
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 40, left: '50%' }, margin: { left: -110 }, width: 220, height: 46, flexDirection: 'column', alignItems: 'center', padding: 6 }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity uiTransform={{ width: '100%', height: 20 }} uiText={{ value: ready ? 'IMPRINT  ·  Left click' : 'IMPRINT  ·  recharging', fontSize: 14, color: c(ready ? COLORS.echoCyan : COLORS.silver) }} />
      <UiEntity uiTransform={{ width: 180, height: 6 }} uiBackground={{ color: c(COLORS.charcoal) }}>
        <UiEntity uiTransform={{ width: `${pct}%`, height: '100%' }} uiBackground={{ color: c(COLORS.echoCyan) }} />
      </UiEntity>
    </UiEntity>
  )
}

function Crosshair() {
  const recentHit = state.lastShot && state.lastShot.kind === 'hit' && state.time - state.lastShot.at < 0.2
  const color = c(recentHit ? COLORS.syncGold : COLORS.ivory, 0.85)
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '50%', left: '50%' }, margin: { top: -9, left: -9 }, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
      <UiEntity uiTransform={{ positionType: 'absolute', width: 2, height: 18 }} uiBackground={{ color }} />
      <UiEntity uiTransform={{ positionType: 'absolute', width: 18, height: 2 }} uiBackground={{ color }} />
    </UiEntity>
  )
}

function Hint() {
  let text = ''
  if (!state.pointerLocked) text = 'Click to take aim'
  else if (state.shots === 0) text = 'Cast a spell at The Watcher  (left click)'
  if (!text) return null
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 100, left: '50%' }, margin: { left: -200 }, width: 400, height: 34, justifyContent: 'center' }}
      uiBackground={{ color: Color4.create(0.04, 0.04, 0.04, 0.55) }}
      uiText={{ value: text, fontSize: 16, color: c(COLORS.echoCyan) }}
    />
  )
}

function Debug() {
  const s = state.lastShot
  const last = s ? `${s.kind}${s.damage ? ` -${s.damage}` : ''}${s.assisted ? ' (assist)' : ''}` : '—'
  const sector = state.playerSector >= 0 ? SECTORS[state.playerSector] : '—'
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 8, right: 8 }, width: 360, height: 24 }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
      uiText={{ value: `M1 debug · last: ${last} · hits ${state.hits}/${state.shots} · sector ${sector} · F = refill boss`, fontSize: 11, color: c(COLORS.ash) }}
    />
  )
}
