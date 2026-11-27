// HUD: a restrained Gothic interface. Dark translucent panels with thin silver borders, serif
// titles, readable sans-serif instructions. Shows: boss name/phase + segmented health, vitality
// and time, Imprint and Convergence readiness, four echo slots, a quadrant compass, objective,
// contextual hints, attack names, the Watcher's subtitles, results. Debug line only if enabled.
import { Color4, Vector3 } from '@dcl/sdk/math'
import { Transform, engine } from '@dcl/sdk/ecs'
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { ARENA, BOSS, COLORS, ECHO, IMPRINT, PLAYER, UI } from '../config'
import { isActive, state } from '../game/state'
import { remainingSeconds, retry, retryGuided } from '../game/session'
import { currentAttack } from '../boss/attacks'
import { objectiveText } from '../game/phases'
import { oldestReplaceable, readyGroup, timeToFire } from '../echoes/echoLogic'
import { readyWindow, formationSectors, requiredSectors } from '../game/assist'
import { sectorOf } from '../combat/aim'
import { LEVEL_STEPS, audioSettings, uiClick } from '../audio/audio'

const c = (hex: string, a = 1) => {
  const k = Color4.fromHexString(hex)
  return Color4.create(k.r, k.g, k.b, a)
}
const PANEL = Color4.create(0.035, 0.035, 0.04, 0.72)
const BORDER = Color4.create(0.59, 0.59, 0.62, 0.55)
const frame = { borderColor: BORDER, borderWidth: 1, borderRadius: 3 }
const SECTORS = ['North', 'East', 'South', 'West']

export function setupHud() {
  ReactEcsRenderer.setUiRenderer(Hud)
}

function Hud() {
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      <HitFlash />
      <ConvergenceFlash />
      <BossBar />
      <Subtitle />
      {isActive() ? <ActiveHud /> : <Results />}
      <EndCinematic />
      <Entrance />
      <SoundPanel />
      <DamageDirection />
      {UI.showDebug ? <Debug /> : null}
    </UiEntity>
  )
}

function ActiveHud() {
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      <PlayerPanel />
      <ImprintIndicator />
      <EchoSlots />
      <ConvergenceIndicator />
      <GuidedConvergence />
      <Message />
      <AttackWarning />
      <Objective />
      {UI.showCrosshair && state.pointerLocked ? <Crosshair /> : null}
      <Hint />
    </UiEntity>
  )
}

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Title card in the first seconds: does not block play. */
function Entrance() {
  const t = state.time
  // the full title card only on the first run; retries go straight back to the fight
  if (!isActive() || t > 5.5 || state.runId > 1) return null
  const a = t < 0.8 ? t / 0.8 : t > 4.2 ? Math.max(0, 1 - (t - 4.2) / 1.3) : 1
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '26%', left: '50%' }, margin: { left: -360 }, width: 720, height: 120, flexDirection: 'column', alignItems: 'center' }}>
      <UiEntity uiTransform={{ width: '100%', height: 64 }} uiText={{ value: 'THE FINAL REHEARSAL', fontSize: 46, font: 'serif', color: c(COLORS.ivory, a) }} />
      <UiEntity uiTransform={{ width: '100%', height: 26 }} uiText={{ value: 'the Chamber of Unforgotten Moments', fontSize: 17, font: 'serif', color: c(COLORS.silver, a) }} />
      <UiEntity uiTransform={{ width: 260, height: 1, margin: { top: 8 } }} uiBackground={{ color: c(COLORS.silver, a * 0.6) }} />
    </UiEntity>
  )
}

/** Vitality and remaining time, top-left. */
// Player vitality: bottom centre, above the echo slots (the top-left corner is covered by the
// Decentraland client's own location panel). A pale "chip" trails each loss so hits read clearly;
// below 30 the bar pulses crimson (a quiet heartbeat plays, audio.ts).
let chipHp = 100
let chipAt = 0
function PlayerPanel() {
  const hp = Math.max(0, state.playerHp)
  const max = PLAYER.maxVitality
  if (hp > chipHp || state.time < chipAt) chipHp = hp
  else chipHp = Math.max(hp, chipHp - 40 * Math.max(0, Math.min(0.05, state.time - chipAt)))
  chipAt = state.time
  const pct = (hp / max) * 100
  const chipPct = (chipHp / max) * 100
  const low = hp <= 30
  const pulse = low ? 0.55 + 0.45 * Math.abs(Math.sin(state.time * 4)) : 1
  const remaining = remainingSeconds()
  const W = 470
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 108, left: '50%' }, margin: { left: -W / 2 }, width: W, height: 32, flexDirection: 'row', alignItems: 'center', padding: { left: 10, right: 10 }, ...frame }} uiBackground={{ color: PANEL }}>
      <UiEntity uiTransform={{ width: 86, height: 20 }} uiText={{ value: state.assist ? 'VITALITY ·G' : 'VITALITY', fontSize: 12, font: 'serif', color: c(low ? COLORS.dangerCrimson : COLORS.silver, low ? pulse : 1), textAlign: 'middle-left' }} />
      <UiEntity uiTransform={{ width: 250, height: 12, borderRadius: 2, borderColor: BORDER, borderWidth: 1 }} uiBackground={{ color: c(COLORS.obsidian) }}>
        <UiEntity uiTransform={{ positionType: 'absolute', position: { left: 0, top: 0 }, width: `${chipPct}%`, height: '100%' }} uiBackground={{ color: c(COLORS.ivory, 0.55) }} />
        <UiEntity uiTransform={{ positionType: 'absolute', position: { left: 0, top: 0 }, width: `${pct}%`, height: '100%' }} uiBackground={{ color: c(low ? COLORS.dangerCrimson : COLORS.echoCyan, low ? pulse : 0.9) }} />
      </UiEntity>
      <UiEntity uiTransform={{ width: 56, height: 20 }} uiText={{ value: `${Math.ceil(hp)}`, fontSize: 15, color: c(low ? COLORS.dangerCrimson : COLORS.ivory), textAlign: 'middle-right' }} />
      <UiEntity uiTransform={{ width: 58, height: 20 }} uiText={{ value: fmt(remaining), fontSize: 12, color: c(remaining < 30 ? COLORS.dangerCrimson : COLORS.silver), textAlign: 'middle-right' }} />
    </UiEntity>
  )
}

// The end of the fight, before the results: defeat closes in crimson, victory floods with gold
// and names the moment. (Results then fade in: defeat after 2.8 s, victory after 6.5 s.)
function EndCinematic() {
  if (isActive()) return null
  const t = state.time - state.endedAt
  if (state.phase === 'defeat') {
    if (t > 3.2) return null
    const k = Math.min(1, t / 1.6)
    return (
      <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
        <EdgeGlow color={Color4.create(0.6, 0.05, 0.12, 0.25 + 0.4 * k)} />
        <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }} uiBackground={{ color: Color4.create(0, 0, 0, 0.55 * Math.max(0, (t - 0.8) / 1.6)) }} />
      </UiEntity>
    )
  }
  if (t > 6.6) return null
  const gold = t < 0.5 ? 0 : Math.max(0, 0.32 * (1 - Math.abs(t - 2.6) / 2.6))
  const title = t < 2.4 ? 0 : t < 3.2 ? (t - 2.4) / 0.8 : t > 5.8 ? Math.max(0, (6.6 - t) / 0.8) : 1
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
      <EdgeGlow color={Color4.create(0.85, 0.72, 0.42, gold)} />
      {title > 0 ? (
        <UiEntity uiTransform={{ width: 900, height: 120, flexDirection: 'column', alignItems: 'center', margin: { bottom: 160 } }}>
          <UiEntity uiTransform={{ width: '100%', height: 64 }} uiText={{ value: 'TIME MOVES FORWARD AGAIN', fontSize: 30 + 10 * title, font: 'serif', color: c(COLORS.syncGold, title) }} />
          <UiEntity uiTransform={{ width: '100%', height: 30 }} uiText={{ value: 'The Watcher could not foresee this moment.', fontSize: 16, font: 'serif', color: c(COLORS.ivory, title * 0.85) }} />
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

/** Brief crimson border when the player is hit (no full-screen flash). */
function HitFlash() {
  const since = state.time - state.playerHitAt
  if (since < 0 || since > 0.35) return null
  return <EdgeGlow color={Color4.create(0.77, 0.13, 0.25, 0.35 * (1 - since / 0.35))} />
}

/** Gold edge glow for a successful Convergence (stronger for more echoes). */
function ConvergenceFlash() {
  const cv = state.lastConvergence
  if (!cv || cv.hits < 2) return null
  const since = state.time - cv.at
  if (since < 0 || since > 0.6) return null
  const k = (cv.hits >= 4 ? 0.42 : cv.hits === 3 ? 0.3 : 0.2) * (1 - since / 0.6)
  return <EdgeGlow color={Color4.create(0.85, 0.72, 0.42, k)} />
}

function EdgeGlow(props: { color: Color4 }) {
  const edge = props.color
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 0, left: 0 }, width: '100%', height: 20 }} uiBackground={{ color: edge }} />
      <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 0, left: 0 }, width: '100%', height: 20 }} uiBackground={{ color: edge }} />
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 0, left: 0 }, width: 20, height: '100%' }} uiBackground={{ color: edge }} />
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 0, right: 0 }, width: 20, height: '100%' }} uiBackground={{ color: edge }} />
    </UiEntity>
  )
}

/** Current objective, always visible under the boss bar. */
function Objective() {
  const hot = state.stage === 'gate' || state.time < state.windowOpenUntil || state.time < state.vulnerableUntil
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 82, left: '50%' }, margin: { left: -280 }, width: 560, height: 22, justifyContent: 'center' }}
      uiText={{ value: objectiveText(), fontSize: 13, color: c(hot ? COLORS.syncGold : COLORS.silver) }}
    />
  )
}

/** Short telegraph label: the floor shape is the real warning, this names it. */
function AttackWarning() {
  const a = currentAttack()
  if (!a || a === 'stolen' || a === 'blindspot' || a === 'observation' || a === 'volley' || a === 'pursuit') return null
  const text = a === 'gaze' ? 'THE GAZE  ·  step out of the crimson cone' : 'AFTERSHOCK  ·  jump the wave or stand in a pale gap'
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 140, left: '50%' }, margin: { left: -230 }, width: 460, height: 28, justifyContent: 'center', ...frame }}
      uiBackground={{ color: Color4.create(0.25, 0.03, 0.07, 0.55) }}
      uiText={{ value: text, fontSize: 14, color: c(COLORS.ivory) }}
    />
  )
}

/** The Watcher's lines: short, non-blocking serif subtitles. */
function Subtitle() {
  if (!state.subtitle || state.time > state.subtitleUntil) return null
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 176, left: '50%' }, margin: { left: -320 }, width: 640, height: 30, justifyContent: 'center' }}
      uiText={{ value: `"${state.subtitle}"`, fontSize: 18, font: 'serif', color: c(COLORS.ash) }}
    />
  )
}

const RANK_NAMES: Record<string, string> = { C: 'APPRENTICE', B: 'TIMEWEAVER', A: 'MASTER OF MOMENTS', S: 'THE UNFORESEEN' }

/** Victory / defeat results with retry (E also retries); guided retry after two defeats. */
function Results() {
  const won = state.phase === 'victory'
  const since = state.time - state.endedAt
  if (since < (won ? 6.5 : 2.8)) return null
  const reveal = since - (won ? 6.5 : 2.8)
  const t = state.endedAt
  const reason = state.endReason === 'time' ? 'Time ran out.' : state.endReason === 'health' ? `Your vitality was exhausted${state.lastHitBy ? ` by ${state.lastHitBy}` : ''}.` : ''
  const tip = state.convergences === 0
    ? 'Tip: cast from two places, then press E when both runes glow gold.'
    : state.bossPhase >= 2
      ? 'Tip: spread echoes over three quadrants (N/E/S/W runes) to break his barriers.'
      : 'Tip: leave the crimson cone, jump the ring or stand in a pale gap.'
  const sc = state.score
  const offerGuided = !won && state.defeats >= 1 && !state.assist
  const lines = [
    won ? `Time ${fmt(t)}   ·   Four-way Convergences ${state.fourWay}   ·   Redirects ${state.redirects}` : `${reason}  Reached phase ${['', 'I', 'II', 'III'][state.bossPhase]}   ·   Survived ${fmt(t)}`,
    `Best Convergence: ${state.bestConvergence > 0 ? `${state.bestConvergence} echoes` : 'none'}   ·   Vitality lost: ${Math.round(state.damageTaken)}`,
    won ? '' : tip
  ].filter((l) => l)
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
      <UiEntity uiTransform={{ width: 620, height: won ? (state.finalFormation.length ? 570 : 400) : 330, flexDirection: 'column', alignItems: 'center', padding: 20, ...frame }} uiBackground={{ color: Color4.create(0.025, 0.025, 0.03, 0.9) }}>
        <UiEntity uiTransform={{ width: '100%', height: 50 }} uiText={{ value: won ? 'THE FINAL REHEARSAL' : 'A MOMENT LOST', fontSize: 32, font: 'serif', color: c(won ? COLORS.syncGold : COLORS.dangerCrimson) }} />
        <UiEntity uiTransform={{ width: 300, height: 1, margin: { bottom: 8 } }} uiBackground={{ color: BORDER }} />
        <UiEntity uiTransform={{ width: '100%', height: 22, margin: { bottom: 6 } }} uiText={{ value: won ? 'Time moves forward again.' : 'The past can always be rewritten.', fontSize: 15, font: 'serif', color: c(COLORS.silver) }} />
        {won && state.finalFormation.length ? <FormationMap /> : null}
        {won && sc ? (
          <UiEntity uiTransform={{ width: '100%', height: 40 }} uiText={{ value: `MASTERY ${Math.round(sc.total * Math.min(1, reveal / 1.6))}   ·   ${state.assist ? 'GUIDED  ·  ' : ''}GRADE ${reveal < 1.7 ? '…' : `${sc.grade} · ${RANK_NAMES[sc.grade] ?? ''}`}${reveal < 1.7 ? '' : state.newBest ? '   ·   NEW PERSONAL BEST' : `   ·   best ${state.assist ? state.personalBestGuided : state.personalBest}`}`, fontSize: reveal >= 1.7 && reveal < 2.0 ? 23 : 19, color: c(reveal >= 1.7 && reveal < 2.0 ? COLORS.syncGold : COLORS.ivory) }} />
        ) : null}
        {lines.map((l, i) => (
          <UiEntity key={`line${i}`} uiTransform={{ width: '100%', height: 24 }} uiText={{ value: l, fontSize: 13, color: c(COLORS.ash) }} />
        ))}
        {won && state.achievements.length ? (
          <UiEntity uiTransform={{ width: '100%', height: 30, flexDirection: 'row', justifyContent: 'center', margin: { top: 6 } }}>
            {state.achievements.filter((_, i) => reveal >= 2.0 + 0.4 * i).map((a, i) => (
              <UiEntity key={`ach${i}`} uiTransform={{ height: 24, width: 12 + a.length * 9, margin: { left: 4, right: 4 }, justifyContent: 'center', ...frame }} uiBackground={{ color: c(COLORS.syncGold, 0.18) }} uiText={{ value: a, fontSize: 11, color: c(COLORS.syncGold) }} />
            ))}
          </UiEntity>
        ) : null}
        <UiEntity uiTransform={{ width: '100%', height: 54, flexDirection: 'row', justifyContent: 'center', margin: { top: 14 } }}>
          <UiEntity
            uiTransform={{ width: 260, height: 46, justifyContent: 'center', margin: { left: 6, right: 6 }, ...frame }}
            uiBackground={{ color: c(won ? COLORS.syncGold : COLORS.ivory, 0.92) }}
            uiText={{ value: won ? 'REHEARSE AGAIN' : 'REWRITE THE MOMENT', fontSize: 17, font: 'serif', color: c(COLORS.obsidian) }}
            onMouseDown={() => {
              uiClick()
              retry()
            }}
          />
          {offerGuided ? (
            <UiEntity
              uiTransform={{ width: 260, height: 46, justifyContent: 'center', margin: { left: 6, right: 6 }, ...frame }}
              uiBackground={{ color: c(COLORS.echoCyan, 0.85) }}
              uiText={{ value: 'REHEARSE WITH GUIDANCE', fontSize: 15, font: 'serif', color: c(COLORS.obsidian) }}
              onMouseDown={() => {
                uiClick()
                retryGuided()
              }}
            />
          ) : null}
        </UiEntity>
        <UiEntity uiTransform={{ width: '100%', height: 20, margin: { top: 4 } }} uiText={{ value: offerGuided ? 'Guidance: more warning time, a wider Convergence window, two sides suffice.  ·  or press E' : 'or press E', fontSize: 11, color: c(COLORS.silver) }} />
      </UiEntity>
    </UiEntity>
  )
}

function BossBar() {
  const segW = 150
  const perSeg = BOSS.phaseHealth
  const segs = [0, 1, 2].map((i) => Math.max(0, Math.min(perSeg, state.bossHp - i * perSeg)) / perSeg)
  const gate = state.stage === 'gate'
  const names = ['', 'I · THE OBSERVER', 'II · THE INTERFERENCE', 'III · THE ALL-SEEING']
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 16, left: '50%' }, margin: { left: -255 }, width: 510, height: 62, flexDirection: 'column', alignItems: 'center', padding: 6, ...frame }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity uiTransform={{ width: '100%', height: 24 }} uiText={{ value: `THE WATCHER   ${names[state.bossPhase]}${gate ? '   ·   BARRIER' : ''}`, fontSize: 16, font: 'serif', color: c(gate ? COLORS.syncGold : COLORS.ivory) }} />
      <UiEntity uiTransform={{ width: segW * 3 + 12, height: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        {segs.map((fill, i) => (
          <UiEntity key={`seg${i}`} uiTransform={{ width: segW, height: 10, borderColor: BORDER, borderWidth: 1 }} uiBackground={{ color: c(COLORS.obsidian, 0.9) }}>
            <UiEntity uiTransform={{ width: `${Math.round(fill * 100)}%`, height: '100%' }} uiBackground={{ color: c(state.time < state.bossFlashUntil ? COLORS.finalWhite : gate && fill > 0 && i === state.bossPhase - 1 ? COLORS.syncGold : COLORS.ash) }} />
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
      uiTransform={{ positionType: 'absolute', position: { bottom: 40, left: '50%' }, margin: { left: -105 }, width: 210, height: 44, flexDirection: 'column', alignItems: 'center', padding: 6, ...frame }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity uiTransform={{ width: '100%', height: 18 }} uiText={{ value: ready ? 'IMPRINT  ·  left click' : 'IMPRINT', fontSize: 13, color: c(ready ? COLORS.echoCyan : COLORS.silver) }} />
      <UiEntity uiTransform={{ width: 170, height: 4, margin: { top: 4 } }} uiBackground={{ color: c(COLORS.charcoal) }}>
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
  else if (!anyRepeat && state.echoes.length > 0) text = 'Your spell remembers...  watch the echo'
  else if (state.echoes.length < 2 && state.convergences === 0) text = 'Move, then cast again: each place keeps its own echo'
  if (!text) return null
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: 108, left: '50%' }, margin: { left: -260 }, width: 520, height: 28, justifyContent: 'center', ...frame }}
      uiBackground={{ color: Color4.create(0.03, 0.03, 0.035, 0.55) }}
      uiText={{ value: text, fontSize: 15, color: c(COLORS.echoCyan) }}
    />
  )
}

/** First Convergence: an unmistakable prompt exactly when it would work. */
function GuidedConvergence() {
  if (state.convergences > 0 || state.time < state.convergenceReadyAt) return null
  const ready = readyGroup(state.echoes, state.time, readyWindow()).length
  if (ready < 2) {
    if (state.echoes.filter((e) => !e.corrupted).length >= 2 && state.echoRepeats > 0) {
      return (
        <UiEntity
          uiTransform={{ positionType: 'absolute', position: { bottom: 200, left: '50%' }, margin: { left: -220 }, width: 440, height: 26, justifyContent: 'center' }}
          uiText={{ value: 'E  ·  synchronize your echoes (instant when their runes glow gold)', fontSize: 14, color: c(COLORS.syncGold, 0.85) }}
        />
      )
    }
    return null
  }
  const pulse = 0.65 + 0.35 * Math.abs(Math.sin(state.time * 6))
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 196, left: '50%' }, margin: { left: -170 }, width: 340, height: 44, justifyContent: 'center', ...frame }}
      uiBackground={{ color: Color4.create(0.85, 0.72, 0.42, 0.22 * pulse) }}
      uiText={{ value: 'PRESS  E   ·   CONVERGENCE', fontSize: 22, font: 'serif', color: c(COLORS.syncGold, pulse) }}
    />
  )
}

function Message() {
  if (!state.message || state.time > state.messageUntil) return null
  const gold = state.message.includes('CONVERGENCE') || state.message.includes('SHATTERS')
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 150, left: '50%' }, margin: { left: -300 }, width: 600, height: 30, justifyContent: 'center', ...frame }}
      uiBackground={{ color: Color4.create(0.03, 0.03, 0.035, 0.62) }}
      uiText={{ value: state.message, fontSize: gold ? 17 : 14, color: c(gold ? COLORS.syncGold : COLORS.ash) }}
    />
  )
}

/** Four echo slots plus a quadrant compass showing which sides hold an echo. */
function EchoSlots() {
  const full = state.echoes.length >= ECHO.maxSlots
  const oldest = full ? oldestReplaceable(state.echoes) : undefined
  const rw = readyWindow()
  const slots = []
  for (let i = 0; i < ECHO.maxSlots; i++) {
    const e = state.echoes[i]
    let label = '·'
    let color = c(COLORS.stone)
    let fill = 0
    let fillColor = c(COLORS.echoCyan)
    if (e) {
      const ttf = timeToFire(e, state.time)
      fill = Math.min(1, Math.max(0, 1 - ttf / ECHO.repeatInterval))
      const ready = !e.corrupted && ttf <= rw
      if (e.corrupted) {
        label = 'STOLEN'
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
      <UiEntity key={`slot${i}`} uiTransform={{ width: 62, height: 36, margin: { right: 5 }, flexDirection: 'column', alignItems: 'center', padding: 3, borderColor: BORDER, borderWidth: 1, borderRadius: 2 }} uiBackground={{ color: Color4.create(0.06, 0.06, 0.07, 0.8) }}>
        <UiEntity uiTransform={{ width: '100%', height: 18 }} uiText={{ value: label, fontSize: 11, color }} />
        <UiEntity uiTransform={{ width: 50, height: 4 }} uiBackground={{ color: c(COLORS.charcoal) }}>
          <UiEntity uiTransform={{ width: `${Math.round(fill * 100)}%`, height: '100%' }} uiBackground={{ color: fillColor }} />
        </UiEntity>
      </UiEntity>
    )
  }
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 40, left: '50%' }, margin: { left: -470 }, width: 350, height: 60, flexDirection: 'row', padding: 5, ...frame }} uiBackground={{ color: PANEL }}>
      <UiEntity uiTransform={{ width: 278, height: 50, flexDirection: 'column' }}>
        <UiEntity uiTransform={{ width: '100%', height: 12 }} uiText={{ value: 'ECHOES', fontSize: 10, color: c(COLORS.silver), textAlign: 'middle-left' }} />
        <UiEntity uiTransform={{ width: '100%', height: 38, flexDirection: 'row' }}>{slots}</UiEntity>
      </UiEntity>
      <Compass />
    </UiEntity>
  )
}

/** N/E/S/W diamonds: lit where an echo stands (gold when ready, crimson if stolen); ring = you. */
function Compass() {
  const rw = readyWindow()
  const look = [0, 1, 2, 3].map((q) => {
    const here = state.echoes.filter((e) => sectorOf(e.pos, ARENA.center, 4) === q)
    if (here.some((e) => e.corrupted)) return c(COLORS.dangerCrimson)
    if (here.some((e) => timeToFire(e, state.time) <= rw)) return c(COLORS.syncGold)
    if (here.length) return c(COLORS.echoCyan)
    return c(COLORS.charcoal)
  })
  // When a sector requirement is active, empty sides pulse gold: "put an echo here".
  const need = requiredSectors()
  const f = formationSectors()
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(state.time * 4))
  const wanted = (q: number) => need > 0 && f.covered.length < need && f.missing.includes(q)
  const dot = (q: number, top: number, left: number) => (
    <UiEntity
      key={`q${q}`}
      uiTransform={{
        positionType: 'absolute', position: { top, left }, width: 14, height: 14, borderRadius: 3,
        borderColor: wanted(q) ? c(COLORS.syncGold, pulse) : state.playerSector === q ? c(COLORS.ivory) : BORDER,
        borderWidth: wanted(q) || state.playerSector === q ? 2 : 1
      }}
      uiBackground={{ color: look[q] }}
    />
  )
  return (
    <UiEntity uiTransform={{ width: 56, height: need > 0 ? 64 : 50 }}>
      {dot(0, 0, 21)}
      {dot(1, 18, 40)}
      {dot(2, 36, 21)}
      {dot(3, 18, 2)}
      {need > 0 ? (
        <UiEntity
          uiTransform={{ positionType: 'absolute', position: { top: 51, left: -8 }, width: 72, height: 13 }}
          uiText={{ value: `SIDES ${Math.min(f.covered.length, 4)}/${need}`, fontSize: 10, color: c(f.covered.length >= need ? COLORS.syncGold : COLORS.ash) }}
        />
      ) : null}
    </UiEntity>
  )
}

function ConvergenceIndicator() {
  const cooldown = Math.max(0, state.convergenceReadyAt - state.time)
  const ready = readyGroup(state.echoes, state.time, readyWindow()).length
  const valid = cooldown <= 0 && ready >= 2
  const text = cooldown > 0 ? `CONVERGENCE  ·  ${cooldown.toFixed(1)}s` : valid ? `CONVERGENCE  ·  E   (${ready} ready)` : 'CONVERGENCE  ·  E'
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 40, left: '50%' }, margin: { left: 120 }, width: 250, height: 44, justifyContent: 'center', alignItems: 'center', ...frame }}
      uiBackground={{ color: valid ? Color4.create(0.85, 0.72, 0.42, 0.26) : PANEL }}
      uiText={{ value: text, fontSize: 14, font: valid ? 'serif' : 'sans-serif', color: c(valid ? COLORS.syncGold : COLORS.silver) }}
    />
  )
}

function Debug() {
  const s = state.lastShot
  const last = s ? `${s.kind}${s.damage ? ` -${s.damage}` : ''}${s.assisted ? ' (assist)' : ''}` : '-'
  const cv = state.lastConvergence
  const conv = cv ? ` · conv ${cv.hits}/${cv.count} -${cv.damage} ${cv.sectors}sec` : ''
  const sector = state.playerSector >= 0 ? SECTORS[state.playerSector] : '-'
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: 8, right: 8 }, width: 470, height: 22 }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
      uiText={{ value: `debug · last: ${last} · hits ${state.hits}/${state.shots}${conv} · sector ${sector} · F refill · 1 mask`, fontSize: 11, color: c(COLORS.ash) }}
    />
  )
}

// Sound panel (bottom right): music and effects levels, mute. Click with the cursor free
// (Esc or right-click releases it).
function SoundPanel() {
  const step = 1 / LEVEL_STEPS
  const change = (key: 'music' | 'sfx', d: number) => {
    audioSettings[key] = Math.round(Math.max(0, Math.min(1, audioSettings[key] + d)) * LEVEL_STEPS) / LEVEL_STEPS
    if (d !== 0 && audioSettings.muted) audioSettings.muted = false
    uiClick()
  }
  const btn = (label: string, onClick: () => void, w = 22) => (
    <UiEntity
      uiTransform={{ width: w, height: 20, justifyContent: 'center', margin: { left: 2, right: 2 }, ...frame }}
      uiBackground={{ color: c(COLORS.obsidian, 0.85) }}
      uiText={{ value: label, fontSize: 12, color: c(COLORS.ivory) }}
      onMouseDown={onClick}
    />
  )
  const row = (name: string, key: 'music' | 'sfx') => (
    <UiEntity uiTransform={{ width: '100%', height: 24, flexDirection: 'row', alignItems: 'center' }}>
      <UiEntity uiTransform={{ width: 58, height: 20 }} uiText={{ value: name, fontSize: 11, font: 'serif', color: c(COLORS.silver), textAlign: 'middle-left' }} />
      {btn('-', () => change(key, -step))}
      <UiEntity uiTransform={{ width: 70, height: 8, flexDirection: 'row', margin: { left: 4, right: 4 } }} uiBackground={{ color: c(COLORS.silver, 0.18) }}>
        <UiEntity uiTransform={{ width: `${Math.round((audioSettings.muted ? 0 : audioSettings[key]) * 100)}%`, height: '100%' }} uiBackground={{ color: c(key === 'music' ? COLORS.ivory : COLORS.echoCyan, 0.85) }} />
      </UiEntity>
      {btn('+', () => change(key, step))}
    </UiEntity>
  )
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { right: 14, bottom: 14 }, width: 230, height: 84, flexDirection: 'column', padding: { left: 8, right: 8, top: 4, bottom: 4 }, ...frame }}
      uiBackground={{ color: PANEL }}
    >
      {row('MUSIC', 'music')}
      {row('EFFECTS', 'sfx')}
      <UiEntity uiTransform={{ width: '100%', height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        {btn(audioSettings.muted ? 'UNMUTE' : 'MUTE', () => {
          audioSettings.muted = !audioSettings.muted
          if (!audioSettings.muted) uiClick()
        }, 74)}
      </UiEntity>
    </UiEntity>
  )
}

// Directional damage: a crimson marker on a ring around the crosshair, pointing toward where the
// hit came from (relative to the camera), with the attack's name. Fades in 1.4 s.
function DamageDirection() {
  const since = state.time - state.playerHitAt
  if (!isActive() || state.playerHitAt <= 0 || since > 1.4) return null
  if (!Transform.has(engine.CameraEntity) || !Transform.has(engine.PlayerEntity)) return null
  const cam = Transform.get(engine.CameraEntity)
  const p = Transform.get(engine.PlayerEntity).position
  const fwd = Vector3.rotate(Vector3.Forward(), cam.rotation)
  const camYaw = Math.atan2(fwd.x, fwd.z)
  const srcYaw = Math.atan2(state.lastHitFrom.x - p.x, state.lastHitFrom.z - p.z)
  const rel = srcYaw - camYaw // 0 = ahead, +pi/2 = to the right
  const a = Math.max(0, 1 - since / 1.4)
  const R = 150
  const x = Math.sin(rel) * R
  const y = -Math.cos(rel) * R
  const behind = Math.cos(rel) < -0.5
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '50%', left: '50%' }, width: 1, height: 1 }}>
      <UiEntity
        uiTransform={{ positionType: 'absolute', position: { left: x - 13, top: y - 13 }, width: 26, height: 26, borderRadius: 13, borderColor: c(COLORS.dangerCrimson, a), borderWidth: 3 }}
        uiBackground={{ color: c(COLORS.dangerCrimson, 0.35 * a) }}
      />
      <UiEntity
        uiTransform={{ positionType: 'absolute', position: { left: x - 90, top: y + (y > 0 ? 16 : -32) }, width: 180, height: 16 }}
        uiText={{ value: `${behind ? 'BEHIND  ·  ' : ''}${state.lastHitBy ?? ''}`, fontSize: 12, color: c(COLORS.dangerCrimson, a) }}
      />
    </UiEntity>
  )
}

// "Your Final Rehearsal": a top-down miniature of the formation that fired the finishing attack,
// drawn from the player's actual echo positions (captured when the finale began).
const MOMENTS = ['', 'One moment', 'Two moments', 'Three moments', 'Four moments']
function FormationMap() {
  const S = 150 // px
  const half = S / 2
  const R = ARENA.playableRadius + 2
  const pts = state.finalFormation.map((p) => ({ x: half + ((p.x - ARENA.center.x) / R) * half, y: half - ((p.z - ARENA.center.z) / R) * half }))
  const sides = new Set(state.finalFormation.map((p) => sectorOf({ x: p.x, y: 0, z: p.z }, ARENA.center, 4))).size
  const n = Math.min(4, pts.length)
  const dots: { x: number; y: number; k: string }[] = []
  pts.forEach((p, i) => {
    for (let j = 1; j < 7; j++) dots.push({ x: half + (p.x - half) * (j / 7), y: half + (p.y - half) * (j / 7), k: `l${i}_${j}` })
  })
  return (
    <UiEntity uiTransform={{ width: '100%', height: 168, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', margin: { bottom: 6 } }}>
      <UiEntity uiTransform={{ width: S, height: S, borderRadius: half, borderColor: BORDER, borderWidth: 1 }} uiBackground={{ color: Color4.create(0.06, 0.06, 0.07, 0.9) }}>
        {/* sector boundaries (diagonals of the N/E/S/W quadrants are drawn as a cross for clarity) */}
        <UiEntity uiTransform={{ positionType: 'absolute', position: { left: half, top: 8 }, width: 1, height: S - 16 }} uiBackground={{ color: c(COLORS.silver, 0.18) }} />
        <UiEntity uiTransform={{ positionType: 'absolute', position: { left: 8, top: half }, width: S - 16, height: 1 }} uiBackground={{ color: c(COLORS.silver, 0.18) }} />
        {dots.map((d) => (
          <UiEntity key={d.k} uiTransform={{ positionType: 'absolute', position: { left: d.x - 1.5, top: d.y - 1.5 }, width: 3, height: 3, borderRadius: 2 }} uiBackground={{ color: c(COLORS.syncGold, 0.8) }} />
        ))}
        {pts.map((p, i) => (
          <UiEntity key={`e${i}`} uiTransform={{ positionType: 'absolute', position: { left: p.x - 7, top: p.y - 7 }, width: 14, height: 14, borderRadius: 7, borderColor: c(COLORS.syncGold), borderWidth: 2 }} uiBackground={{ color: c(COLORS.echoCyan, 0.9) }} />
        ))}
        <UiEntity uiTransform={{ positionType: 'absolute', position: { left: half - 8, top: half - 8 }, width: 16, height: 16, borderRadius: 8, borderColor: c(COLORS.ivory), borderWidth: 2 }} uiBackground={{ color: c(COLORS.dangerCrimson) }} />
        <UiEntity uiTransform={{ positionType: 'absolute', position: { left: half - 10, top: -2 }, width: 20, height: 12 }} uiText={{ value: 'N', fontSize: 9, color: c(COLORS.silver) }} />
      </UiEntity>
      <UiEntity uiTransform={{ width: 250, height: S, flexDirection: 'column', justifyContent: 'center', margin: { left: 18 } }}>
        <UiEntity uiTransform={{ width: '100%', height: 18 }} uiText={{ value: 'YOUR FINAL REHEARSAL', fontSize: 12, color: c(COLORS.silver), textAlign: 'middle-left' }} />
        <UiEntity uiTransform={{ width: '100%', height: 28 }} uiText={{ value: `${MOMENTS[n]}. One impossible outcome.`, fontSize: 15, font: 'serif', color: c(COLORS.syncGold), textAlign: 'middle-left' }} />
        <UiEntity uiTransform={{ width: '100%', height: 20 }} uiText={{ value: `${n} echoes  ·  ${sides} direction${sides === 1 ? '' : 's'}${state.finaleHit ? '' : '  ·  flawless finale'}`, fontSize: 12, color: c(COLORS.ash), textAlign: 'middle-left' }} />
      </UiEntity>
    </UiEntity>
  )
}
