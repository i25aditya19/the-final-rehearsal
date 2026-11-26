/**
 * THE FINAL REHEARSAL — single tuning module.
 *
 * Every gameplay number lives here so balance can be changed without touching systems.
 * Values marked BASELINE in docs/GAME_DESIGN.md are starting points to validate in playtests.
 * Times are in seconds, distances in metres, angles in degrees.
 */

export const ARENA = {
  /** Scene is 5x5 parcels (80m x 80m). Arena centre in scene coordinates. */
  center: { x: 40, y: 0, z: 40 },
  /** Unobstructed circular playable floor radius. */
  playableRadius: 20,
  /** Walkable floor height (the floor plane sits above the client's default ground). */
  floorY: 0.08,
  /** Margin between the playable floor and walls/decoration. */
  borderMargin: 3,
  /** Radius of the central dais (the Watcher hovers above it). */
  daisRadius: 4.5,
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
  hitRadius: 2.1,
  hitHeight: 7.2,
  /** Height of the boss's centre (model origin) above the floor. */
  hoverHeight: 3.85
} as const

/**
 * The Watcher's modular model (Aholo-generated, optimized copies in assets/boss/).
 * Model units are metres; the body model is 4.02 m tall with its origin at its centre.
 * If any file is missing or fails to load, the primitive placeholder is shown instead.
 */
export const WATCHER_MODEL = {
  enabled: true,
  /** Visual scale only (hit volume is BOSS.hitRadius/hitHeight). 1.65 -> 1.85: more imposing. */
  scale: 1.85,
  body: 'assets/boss/watcher_body.glb',
  helm: 'assets/boss/watcher_helm.glb',
  mask: 'assets/boss/watcher_mask.glb',
  halo: 'assets/boss/watcher_halo.glb',
  hand: 'assets/boss/watcher_hand.glb',
  /** Head centre in body-model units (front is +Z). Halo and mask are placed relative to it. */
  head: { x: 0, y: 1.78, z: 0 },
  /** Halo model diameter is 0.30 m; three rings at these world diameters, behind the head. */
  haloDiameters: [1.9, 2.7, 3.5],
  haloSpeeds: [16, -10, 6],
  /** Behind the head, clear of the shoulders and robe (checked against the model's depth). */
  haloOffsetZ: -1.05,
  /** Spectral hands floating beside the body (world metres relative to the boss root). */
  handScale: 2.0,
  handOffsets: [
    { x: -2.6, y: 0.3, z: 0.9 },
    { x: 2.6, y: 0.3, z: 0.9 }
  ],
  /** Mask placement when it replaces the helm (final transformation), body-model units. */
  maskScale: 2.15,
  maskOffset: { x: 0, y: 1.8, z: 0.17 },
  /** The ivory mask is his face from the first moment (the dark helm is kept only as a fallback). */
  startVisage: 'mask' as 'mask' | 'helm'
} as const

export const IMPRINT = {
  cooldown: 1,
  directDamage: 5,
  echoDamage: 3,
  /** Range of a spell before it fizzles. */
  range: 46,
  /** Flight speed of a spell projectile (m/s). */
  projectileSpeed: 34,
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
  /** Development aids: debug line, F refills the boss, 1 swaps mask/helm. Off for release. */
  showDebug: false
} as const

export const ECHO = {
  repeatInterval: 4,
  maxSlots: 4,
  maxCorrupted: 1,
  /** Casting within this distance of an existing echo refreshes it instead of adding one. */
  minSeparation: 3,
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
  initialInterval: 10,
  /** Hostile shot: aim follows the player while charging, then locks, then fires. */
  charge: 1.0,
  lock: 0.7,
  hostileSpeed: 26,
  /** Player within this distance of the hostile shot's path when it lands is hit. */
  hitRadius: 1.1,
  anchorRadius: 0.9,
  anchorHeight: 1.4
} as const

export const ATTACKS = {
  /** Seconds after the run starts before the first attack (onboarding grace). */
  firstAttackDelay: 12,
  /** Quiet time between the end of one attack and the next warning. */
  recovery: 4.5,
  /**
   * The Gaze: crimson cone from the boss toward the player. Tracks during (warning - lockedAim),
   * then locks; damage once if the player is inside when it fires.
   * BASELINE was 45 deg / 1.2 s / 0.6 s locked; narrowed and lengthened slightly so a sidestep
   * is achievable at the arena edge with native movement. Tune after playtests.
   */
  gaze: { coneDeg: 34, warning: 1.5, lockedAim: 0.8, damage: 15, range: 24, flashSeconds: 0.35 },
  /**
   * Aftershock: low ring wave expanding from the dais. Avoid by jumping over it or by standing in
   * one of the safe gaps. Two waves, the second `repeatDelay` s after the first.
   */
  aftershock: {
    warning: 1.5,
    damage: 10,
    repeatDelay: 4,
    startRadius: 4.6,
    speed: 10,
    bandWidth: 1.1,
    /** Feet higher than this when the wave passes = jumped clear. */
    jumpClear: 0.45,
    gapCount: 2,
    gapDeg: 50
  },
  /**
   * Archive Volley (added at the creator's request, phases II-III): the halos fire spiralling
   * waves of crimson bolts outward in every direction. Slip between the lines (or jump them).
   */
  volley: { warning: 1.3, waves: 3, boltsPerWave: 14, waveInterval: 0.75, spinDeg: 9, speed: 9, damage: 8, hitRadius: 0.75, boltHeight: 1.15, jumpClear: 0.9 },
  /** BASELINE warning 2 s; 3 s so the adjacent safe quadrant is reachable on the larger floor. */
  blindSpot: { warning: 3, safeSectorDeg: 90, vulnerability: 5, damage: 15 },
  /** Phase III: warning with safe circles, 20-damage pulse, then the barrier opens. */
  finalObservation: { warning: 2.2, pulseDamage: 20, openWindow: 5.5, rest: 3.5, safeRadius: 3.2, safeRingFraction: 0.62 }
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
