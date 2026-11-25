// M1 HUD: boss name + segmented health bar, Imprint readiness, crosshair, contextual hint, debug.
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { BOSS, COLORS, CONVERGENCE, ECHO, IMPRINT, UI } from '../config'
import { state } from '../game/state'
import { oldestReplaceable, readyGroup, timeToFire } from '../echoes/echoLogic'

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
      <EchoSlots />
      <ConvergenceIndicator />
      <Message />
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
  const anyRepeat = state.echoRepeats > 0
  if (!state.pointerLocked) text = 'Click to take aim'
  else if (state.shots === 0) text = 'Cast a spell at The Watcher  (left click)'
  else if (!anyRepeat && state.echoes.length > 0) text = 'Your spell remembers...'
  else if (state.echoes.length < 2 && state.convergences === 0) text = 'Move, then cast again: each spot keeps its own echo'
  else if (state.convergences === 0) text = 'When the echo runes glow gold, press E  ·  Convergence'
  if (!text) return null
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 100, left: '50%' }, margin: { left: -260 }, width: 520, height: 34, justifyContent: 'center' }}
      uiBackground={{ color: Color4.create(0.04, 0.04, 0.04, 0.55) }}
      uiText={{ value: text, fontSize: 16, color: c(COLORS.echoCyan) }}
    />
  )
}

function Message() {
  if (!state.message || state.time > state.messageUntil) return null
  const gold = state.message.includes('CONVERGENCE')
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 150, left: '50%' }, margin: { left: -260 }, width: 520, height: 32, justifyContent: 'center' }}
      uiBackground={{ color: Color4.create(0.04, 0.04, 0.04, 0.6) }}
      uiText={{ value: state.message, fontSize: gold ? 18 : 15, color: c(gold ? COLORS.syncGold : COLORS.ash) }}
    />
  )
}

/** Four echo slots: rune progress, gold when ready, "next" marks the one a new echo replaces. */
function EchoSlots() {
  const full = state.echoes.length >= ECHO.maxSlots
  const oldest = full ? oldestReplaceable(state.echoes) : undefined
  const slots = []
  for (let i = 0; i < ECHO.maxSlots; i++) {
    const e = state.echoes[i]
    let label = '—'
    let color = c(COLORS.stone)
    let fill = 0
    let fillColor = c(COLORS.echoCyan)
    if (e) {
      const ttf = timeToFire(e, state.time)
      fill = Math.min(1, Math.max(0, 1 - ttf / ECHO.repeatInterval))
      const ready = !e.corrupted && ttf <= CONVERGENCE.readyWindow
      if (e.corrupted) {
        label = 'LOST'
        color = c(COLORS.dangerCrimson)
        fillColor = color
      } else if (ready) {
        label = 'READY'
        color = c(COLORS.syncGold)
        fillColor = color
      } else {
        label = `${ttf.toFixed(1)}s`
        color = c(COLORS.echoCyan)
      }
      if (oldest && oldest.id === e.id) label += ' · next'
    }
    slots.push(
      <UiEntity key={`slot${i}`} uiTransform={{ width: 74, height: 38, margin: { right: 6 }, flexDirection: 'column', alignItems: 'center', padding: 3 }} uiBackground={{ color: Color4.create(0.08, 0.08, 0.08, 0.8) }}>
        <UiEntity uiTransform={{ width: '100%', height: 20 }} uiText={{ value: label, fontSize: 12, color }} />
        <UiEntity uiTransform={{ width: 60, height: 5 }} uiBackground={{ color: c(COLORS.charcoal) }}>
          <UiEntity uiTransform={{ width: `${Math.round(fill * 100)}%`, height: '100%' }} uiBackground={{ color: fillColor }} />
        </UiEntity>
      </UiEntity>
    )
  }
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 40, left: '50%' }, margin: { left: -460 }, width: 330, height: 58, flexDirection: 'column', padding: 4 }} uiBackground={{ color: PANEL }}>
      <UiEntity uiTransform={{ width: '100%', height: 14 }} uiText={{ value: 'ECHOES', fontSize: 11, color: c(COLORS.silver), textAlign: 'middle-left' }} />
      <UiEntity uiTransform={{ width: '100%', height: 40, flexDirection: 'row' }}>{slots}</UiEntity>
    </UiEntity>
  )
}

function ConvergenceIndicator() {
  const cooldown = Math.max(0, state.convergenceReadyAt - state.time)
  const ready = readyGroup(state.echoes, state.time, CONVERGENCE.readyWindow).length
  const valid = cooldown <= 0 && ready >= CONVERGENCE.minEchoes
  const text = cooldown > 0 ? `CONVERGENCE · ${cooldown.toFixed(1)}s` : valid ? `CONVERGENCE · E  (${ready} ready)` : 'CONVERGENCE · E'
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 40, left: '50%' }, margin: { left: 130 }, width: 250, height: 46, justifyContent: 'center', alignItems: 'center' }}
      uiBackground={{ color: valid ? Color4.create(0.85, 0.72, 0.42, 0.28) : PANEL }}
      uiText={{ value: text, fontSize: 15, color: c(valid ? COLORS.syncGold : COLORS.silver) }}
    />
  )
}

function Debug() {
  const s = state.lastShot
  const last = s ? `${s.kind}${s.damage ? ` -${s.damage}` : ''}${s.assisted ? ' (assist)' : ''}` : '—'
  const cv = state.lastConvergence
  const conv = cv ? ` · conv ${cv.hits}/${cv.count} -${cv.damage} ${cv.sectors}sec` : ''
  const sector = state.playerSector >= 0 ? SECTORS[state.playerSector] : '—'
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 8, right: 8 }, width: 470, height: 24 }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
      uiText={{ value: `M2 debug · last: ${last} · hits ${state.hits}/${state.shots}${conv} · sector ${sector} · F refill · 1 mask`, fontSize: 11, color: c(COLORS.ash) }}
    />
  )
}
