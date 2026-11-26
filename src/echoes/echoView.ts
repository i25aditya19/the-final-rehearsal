// Visuals for the four echo slots: a translucent cyan spectral sorcerer standing on a floor rune
// that fills over the repeat cycle and turns gold inside the Convergence ready window.
import { Entity, GltfContainer, Material, MaterialTransparencyMode, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { autoCull } from '../effects/visibility'
import { readyWindow } from '../game/assist'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { COLORS, CONVERGENCE, ECHO } from '../config'
import { headingDeg } from '../math/vec'
import { state } from '../game/state'
import { timeToFire } from './echoLogic'
import { burst } from '../effects/vfx'

type Look = 'idle' | 'ready' | 'fired' | 'corrupt'
type View = { root: Entity; body: Entity; hood: Entity; fill: Entity; model: Entity; aim: Entity; look: Look | ''; fillLook: string; aimLook: string; echoId: number; bornAt: number; lastPos?: { x: number; z: number } }
const AIM_LENGTH = 8
const AXIS_FIX = Quaternion.fromEulerDegrees(90, 0, 0)
/** Aholo spectral sorcerer (cyan, translucent). The primitive body becomes a state-coloured aura. */
const ECHO_MODEL = 'assets/echoes/spectral_echo.glb'
const ECHO_MODEL_SCALE = 0.85
const views: View[] = []
const HIDDEN = Vector3.create(0, -20, 0)

const rgba = (hex: string, a: number) => {
  const c = Color4.fromHexString(hex)
  return Color4.create(c.r, c.g, c.b, a)
}
const rgb = (hex: string) => {
  const c = Color4.fromHexString(hex)
  return Color3.create(c.r, c.g, c.b)
}

function ghostMaterial(e: Entity, hex: string, alpha: number, glow: number) {
  Material.setPbrMaterial(e, {
    albedoColor: rgba(hex, alpha),
    emissiveColor: rgb(hex),
    emissiveIntensity: glow,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    roughness: 1
  })
}

export function createEchoViews() {
  for (let i = 0; i < ECHO.maxSlots; i++) {
    const root = engine.addEntity()
    Transform.create(root, { position: HIDDEN })

    // Rune: dark plate with an engraved silver edge; the fill disc grows inside it.
    const edge = engine.addEntity()
    Transform.create(edge, { parent: root, position: Vector3.create(0, 0.145, 0), scale: Vector3.create(1.6, 0.01, 1.6) })
    MeshRenderer.setCylinder(edge)
    Material.setPbrMaterial(edge, { albedoColor: rgba(COLORS.silver, 1), emissiveColor: rgb(COLORS.silver), emissiveIntensity: 0.3 })
    const plate = engine.addEntity()
    Transform.create(plate, { parent: root, position: Vector3.create(0, 0.15, 0), scale: Vector3.create(1.45, 0.01, 1.45) })
    MeshRenderer.setCylinder(plate)
    Material.setPbrMaterial(plate, { albedoColor: rgba(COLORS.obsidian, 1) })
    const fill = engine.addEntity()
    Transform.create(fill, { parent: root, position: Vector3.create(0, 0.155, 0), scale: Vector3.create(0, 0.01, 0) })
    MeshRenderer.setCylinder(fill)

    // Spectral sorcerer: tapering robe + hood, translucent cyan.
    const body = engine.addEntity()
    Transform.create(body, { parent: root, position: Vector3.create(0, 0.85, 0), scale: Vector3.create(0.9, 1.7, 0.9) })
    MeshRenderer.setCylinder(body, 0.5, 0.18)
    const hood = engine.addEntity()
    Transform.create(hood, { parent: root, position: Vector3.create(0, 1.85, 0.02), scale: Vector3.create(0.42, 0.52, 0.44) })
    MeshRenderer.setSphere(hood)
    // Casting arm pointing along the remembered direction.
    const arm = engine.addEntity()
    Transform.create(arm, { parent: root, position: Vector3.create(0.22, 1.35, 0.32), scale: Vector3.create(0.1, 0.6, 0.1), rotation: Quaternion.fromEulerDegrees(90, 0, 0) })
    MeshRenderer.setCylinder(arm, 0.5, 0.3)
    ghostMaterial(arm, COLORS.echoCyan, 0.55, 1.5)

    const model = engine.addEntity()
    Transform.create(model, { parent: root, position: Vector3.create(0, 1.1 * ECHO_MODEL_SCALE, 0), scale: Vector3.create(ECHO_MODEL_SCALE, ECHO_MODEL_SCALE, ECHO_MODEL_SCALE) })
    GltfContainer.create(model, { src: ECHO_MODEL, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
    // Aim line: where this echo's remembered spell will fly (faint; gold when ready).
    const aim = engine.addEntity()
    Transform.create(aim, { position: HIDDEN, scale: Vector3.Zero() })
    MeshRenderer.setCylinder(aim, 0.5, 0.15)
    views.push({ root, body, hood, fill, model, aim, look: '', fillLook: '', aimLook: '', echoId: -1, bornAt: -10 })
  }
  for (const v of views) autoCull(v.root, v.aim)
  engine.addSystem(echoViewSystem)
}

function echoViewSystem() {
  for (let i = 0; i < views.length; i++) {
    const v = views[i]
    const e = state.echoes[i]
    const rootT = Transform.getMutable(v.root)
    if (!e) {
      rootT.position = HIDDEN
      Transform.getMutable(v.aim).scale = Vector3.Zero()
      if (v.echoId !== -1 && v.lastPos) burst({ x: v.lastPos.x, y: 1.2, z: v.lastPos.z }, COLORS.echoCyan, 0.6)
      v.echoId = -1
      continue
    }
    if (e.id !== v.echoId) {
      // A new echo materialises (or replaces the oldest: the old one dissolves in a flare).
      if (v.echoId !== -1 && v.lastPos) burst({ x: v.lastPos.x, y: 1.2, z: v.lastPos.z }, COLORS.echoCyan, 0.6)
      v.echoId = e.id
      v.bornAt = state.time
      burst({ x: e.pos.x, y: 1.0, z: e.pos.z }, COLORS.echoCyan, 0.9)
    }
    v.lastPos = { x: e.pos.x, z: e.pos.z }
    // Appearance: rises from the rune and grows to full size over 0.5 s.
    const grow = Math.min(1, (state.time - v.bornAt) / 0.5)
    const ease = 1 - (1 - grow) * (1 - grow)
    rootT.position = Vector3.create(e.pos.x, e.pos.y - 0.6 * (1 - ease), e.pos.z)
    rootT.scale = Vector3.create(0.4 + 0.6 * ease, ease, 0.4 + 0.6 * ease)
    rootT.rotation = Quaternion.fromEulerDegrees(0, headingDeg(e.dir), 0)

    const ttf = timeToFire(e, state.time)
    const ready = !e.corrupted && ttf <= readyWindow()
    const justFired = state.time - e.lastFired < 0.25

    const look: Look = state.phase === 'victory' ? 'ready' : e.corrupted ? 'corrupt' : justFired ? 'fired' : ready ? 'ready' : 'idle'
    if (look !== v.look) {
      const hex = look === 'corrupt' ? COLORS.dangerCrimson : look === 'ready' ? COLORS.syncGold : COLORS.echoCyan
      const glow = look === 'fired' ? 4 : look === 'ready' ? 2.2 : 1.2
      // With the model present, the primitive figure is a faint aura showing the echo's state;
      // a corrupted echo hides the cyan model and shows a solid crimson figure instead.
      const aura = look === 'corrupt' ? 0.6 : look === 'fired' ? 0.32 : look === 'ready' ? 0.24 : 0.08
      ghostMaterial(v.body, hex, aura, glow)
      ghostMaterial(v.hood, hex, aura, glow)
      const k = look === 'corrupt' ? 0 : ECHO_MODEL_SCALE
      Transform.getMutable(v.model).scale = Vector3.create(k, k, k)
      v.look = look
    }

    // Aim line from the echo's spell origin along its remembered direction.
    const aimHex = e.corrupted ? COLORS.dangerCrimson : ready ? COLORS.syncGold : COLORS.echoCyan
    if (aimHex !== v.aimLook) {
      v.aimLook = aimHex
      const c = Color4.fromHexString(aimHex)
      Material.setPbrMaterial(v.aim, { albedoColor: Color4.create(c.r, c.g, c.b, ready ? 0.42 : 0.22), emissiveColor: Color3.create(c.r, c.g, c.b), emissiveIntensity: ready ? 2.5 : 1.2, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
    }
    const at = Transform.getMutable(v.aim)
    const L = AIM_LENGTH * ease
    at.position = Vector3.create(e.origin.x + e.dir.x * L / 2, e.origin.y + e.dir.y * L / 2, e.origin.z + e.dir.z * L / 2)
    at.rotation = Quaternion.multiply(Quaternion.lookRotation(Vector3.create(e.dir.x, e.dir.y, e.dir.z)), AXIS_FIX)
    const w = ready ? 0.07 : 0.045
    at.scale = Vector3.create(w, Math.max(0.01, L), w)

    // Rune fills over the cycle; gold in the ready window.
    const progress = Math.min(1, Math.max(0, 1 - ttf / ECHO.repeatInterval))
    const fillT = Transform.getMutable(v.fill)
    const d = 1.4 * progress
    fillT.scale = Vector3.create(d, 0.01, d)
    const fillLook = e.corrupted ? 'c' : ready ? 'g' : 'b'
    if (fillLook !== v.fillLook) {
      const hex = fillLook === 'c' ? COLORS.dangerCrimson : fillLook === 'g' ? COLORS.syncGold : COLORS.echoCyan
      Material.setPbrMaterial(v.fill, { albedoColor: rgba(hex, 1), emissiveColor: rgb(hex), emissiveIntensity: fillLook === 'g' ? 3 : 1.6 })
      v.fillLook = fillLook
    }
  }
}
