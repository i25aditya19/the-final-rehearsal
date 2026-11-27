// Victory cinematic: one continuous camera move (Catmull-Rom spline, eased), driven by a
// VirtualCamera's Transform each frame:
//   hero close-up on the player's avatar (Victory pose) -> crane up and back over the arena ->
//   high over the floor emblem -> rising through the dome -> outside, above the chamber ->
//   wide exterior of the whole building (title card in hud.tsx).
// E skips to the results. The camera is released with the engine's 0.5 s blend; the rig entity is
// kept and reused (no delete-ordering pitfalls). Bounds: every keyframe stays inside the scene.
import { InputAction, MainCamera, PointerEventType, Transform, VirtualCamera, engine, inputSystem, Entity } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, SESSION } from '../config'
import { state } from '../game/state'
import { onReset } from '../game/session'

type K = { t: number; pos: Vector3; look: Vector3 }
let cam: Entity | undefined
let keys: K[] = []
let running = false

/** Seconds after victory when the results appear (earlier if the player skipped). */
export function victoryResultsAt(): number {
  return state.cinematicSkipAt > 0 ? Math.min(SESSION.victoryResultsAt, state.cinematicSkipAt - state.endedAt + 0.3) : SESSION.victoryResultsAt
}
export function cinematicActive(): boolean {
  return running
}

export function initCinematic() {
  cam = engine.addEntity()
  Transform.create(cam, { position: Vector3.create(ARENA.center.x, 5, ARENA.center.z) })
  VirtualCamera.create(cam, { fov: 60, defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.8) } })
  engine.addSystem(cinematicSystem, 30000, 'cinematic')
  onReset(stop)
}

function stop() {
  if (!running) return
  running = false
  const m = MainCamera.getMutableOrNull(engine.CameraEntity)
  if (m) m.virtualCameraEntity = undefined
}

function plan() {
  const C = Vector3.create(ARENA.center.x, 0, ARENA.center.z)
  const p = Transform.getOrNull(engine.PlayerEntity)?.position ?? Vector3.create(C.x, 0, C.z - 14)
  let d = Vector3.create(p.x - C.x, 0, p.z - C.z) // from the Watcher out to the player
  if (Vector3.length(d) < 2) d = Vector3.create(0, 0, -1)
  d = Vector3.normalize(d)
  const side = Vector3.create(d.z, 0, -d.x)
  const at = (o: Vector3, along: number, up: number, across = 0) => Vector3.create(o.x + d.x * along + side.x * across, up, o.z + d.z * along + side.z * across)
  const chest = Vector3.create(p.x, p.y + 1.25, p.z)
  // exterior corner on the player's side, clamped inside the scene (VirtualCameras are disabled outside it)
  const ext = Vector3.create(Math.max(2, Math.min(78, C.x + (d.x + side.x * 0.6) * 37)), 44, Math.max(2, Math.min(78, C.z + (d.z + side.z * 0.6) * 37)))
  const S = SESSION.cinematicStart
  keys = [
    { t: S, pos: at(p, -3.6, p.y + 1.6, 0.4), look: chest }, // in front of the player (between them and where he fell)
    { t: S + 2.6, pos: at(p, -2.5, p.y + 1.35, 1.6), look: chest }, // slow push-in, orbiting
    { t: S + 5.0, pos: at(p, 5.5, 8.5, 2.5), look: Vector3.create(C.x, 2.5, C.z) }, // crane up and back over the arena
    { t: S + 7.6, pos: at(C, 9, 21, -3), look: Vector3.create(C.x, 0, C.z) }, // high: the floor emblem, the whole arena
    { t: S + 10.0, pos: at(C, 13, 39, -4), look: Vector3.create(C.x, 22, C.z) }, // up through the dome, outside above it
    { t: S + 13.2, pos: ext, look: Vector3.create(C.x, 17, C.z) } // the whole chamber from outside
  ]
}

const ease = (x: number) => x * x * (3 - 2 * x)
function catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, u: number): Vector3 {
  const u2 = u * u
  const u3 = u2 * u
  const f = (a: number, b: number, c: number, e: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - e) * u2 + (-a + 3 * b - 3 * c + e) * u3)
  return Vector3.create(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z))
}
function sample(t: number, field: 'pos' | 'look'): Vector3 {
  if (t <= keys[0].t) return keys[0][field]
  const last = keys[keys.length - 1]
  if (t >= last.t) return last[field]
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].t) i++
  const u = ease((t - keys[i].t) / (keys[i + 1].t - keys[i].t))
  const g = (k: number) => keys[Math.max(0, Math.min(keys.length - 1, k))][field]
  return catmull(g(i - 1), g(i), g(i + 1), g(i + 2), u)
}

function cinematicSystem() {
  if (!cam) return
  if (state.phase !== 'victory') {
    if (running) stop()
    return
  }
  const t = state.time - state.endedAt
  if (!running && t >= SESSION.cinematicStart && t < SESSION.cinematicEnd && state.cinematicSkipAt === 0) {
    plan()
    running = true
    MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: cam })
  }
  if (!running) return
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN) && t > SESSION.cinematicStart + 0.5) {
    state.cinematicSkipAt = state.time
    stop()
    return
  }
  if (t >= SESSION.cinematicEnd) {
    stop()
    return
  }
  const pos = sample(t, 'pos')
  const look = sample(t + 0.25, 'look') // the eye leads the move slightly
  const tr = Transform.getMutable(cam)
  tr.position = pos
  tr.rotation = Quaternion.fromLookAt(pos, look)
}
