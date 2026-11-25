/**
 * THE FINAL REHEARSAL — single tuning module.
 *
 * Every gameplay number lives here so balance can be changed without touching systems.
 * Values marked BASELINE in docs/GAME_DESIGN.md are starting points to validate in playtests.
 * Times are in seconds, distances in metres, angles in degrees.
 */

export const ARENA = {
  /** Scene is 3x3 parcels (48m x 48m). Arena centre in scene coordinates. */
  center: { x: 24, y: 0, z: 24 },
  /** Unobstructed circular playable floor radius. */
  playableRadius: 12,
  /** Margin between the playable floor and walls/decoration. */
  borderMargin: 2,
  /** Number of directional sectors around the boss (90 degrees each). */
  sectorCount: 4,
  /** Angular hysteresis at sector boundaries, to avoid surprising flips. */
  sectorHysteresisDeg: 8
} as const

export const SESSION = {
  /** Hard combat cap including onboarding and transitions. */
  hardCapSeconds: 285,
  /** Maximum length of the victory/defeat end sequence. */
  endSequenceMaxSeconds: 10,
  /** Largest dt a single frame may advance the simulation (protects against hitches). */
  maxFrameDt: 0.1,
  /** Pause between phases (no damage, timers frozen). */
  transitionSeconds: 3
} as const

export const PLAYER = {
  maxVitality: 100,
  healPerPhase: 15,
  postHitImmunity: 0.8
} as const

export const BOSS = {
  maxHealth: 300,
  phaseHealth: 100,
  /** Forgiving cylindrical hit volume around the boss. */
  hitRadius: 1.6,
  hitHeight: 5,
  /** Height of the boss's centre of mass above the floor. */
  hoverHeight: 2.5
} as const

export const IMPRINT = {
  cooldown: 1,
  directDamage: 5,
  echoDamage: 3,
  /** Range of a spell trace before it fizzles. */
  range: 30,
  /** Spell leaves the caster at this height above the avatar's feet. */
  castHeight: 1.3,
  /**
   * Aim assist: if the shot's horizontal direction is within this many degrees of the boss,
   * it is snapped onto the boss. Keeps aiming forgiving and predictable.
   */
  aimAssistDeg: 6,
  /** How long a spell trace stays visible. */
  tracerSeconds: 0.3,
  tracerWidth: 0.08
} as const

export const UI = {
  /** Draw a small scene crosshair while the cursor is locked. */
  showCrosshair: true,
  /** Show the M1 debug line (last shot, sector, position). */
  showDebug: true
} as const

export const ECHO = {
  repeatInterval: 4,
  maxSlots: 4,
  maxCorrupted: 1,
  /** Casting within this distance of an existing echo refreshes it instead of adding one. */
  minSeparation: 2,
  /**
   * Forgiving synchronization (brief 7.2 allows it): a new or refreshed echo joins the cycle of
   * the existing formation if its natural first repeat would land within this many seconds of
   * the formation's beat. 2.0 = always joins (formation stays in phase); 0 = no snapping.
   */
  phaseSnap: 2,
  /** A snapped echo never repeats sooner than this after being placed. */
  minFirstDelay: 2
} as const

export const CONVERGENCE = {
  cooldown: 6,
  /** Echoes whose next cast is due within this window may join a Convergence. */
  readyWindow: 1,
  minEchoes: 2,
  /** Aggregate damage for 2, 3 and 4 participating echoes (replaces individual echo hits). */
  damageByCount: { 2: 12, 3: 24, 4: 40 } as Record<number, number>
} as const

export const CORRUPTION = {
  warning: 2.5,
  hostileDamage: 12,
  redirectDamage: 15,
  autoExpire: 8,
  initialInterval: 10
} as const

export const ATTACKS = {
  gaze: { coneDeg: 45, warning: 1.2, lockedAim: 0.6, damage: 15 },
  aftershock: { warning: 1.5, damage: 10, repeatDelay: 4 },
  blindSpot: { warning: 2, safeSectorDeg: 90, vulnerability: 5, damage: 15 },
  finalObservation: { pulseDamage: 20, openWindow: 5, cycle: 11 }
} as const

export const PHASES = {
  /** Ordinary damage multiplier in phase II outside vulnerability windows. */
  phase2OrdinaryMultiplier: 0.25,
  /** Distinct sectors required to break the phase II gate (may drop to 2 after novice tests). */
  phase2GateSectors: 3,
  /** Distinct sectors required for a qualifying final Convergence. */
  phase3MinSectors: 3,
  /** Seconds without progress before a contextual hint appears. */
  stallHintSeconds: 8
} as const

export const COLORS = {
  obsidian: '#0B0B0B',
  charcoal: '#242424',
  stone: '#515151',
  silver: '#969696',
  ash: '#D4D4D4',
  ivory: '#F1EFEA',
  echoCyan: '#85DFFF',
  syncGold: '#D8B76B',
  dangerCrimson: '#C5223F',
  finalWhite: '#FFFFFF'
} as const
