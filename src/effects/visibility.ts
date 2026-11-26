// Pooled effects must not just be moved away or scaled to zero: the renderer still counts them.
// setShown toggles VisibilityComponent (propagating to children) and only writes on change.
import { Entity, Transform, VisibilityComponent, engine } from '@dcl/sdk/ecs'

const cache = new Map<Entity, boolean>()

export function setShown(e: Entity, shown: boolean) {
  if (cache.get(e) === shown) return
  cache.set(e, shown)
  VisibilityComponent.createOrReplace(e, { visible: shown, propagateToChildren: true })
}

// Auto-cull: pooled entities that are parked (scale 0 or moved below the floor) are hidden by a
// late system, so callers that only move/scale things away also stop being rendered.
const watched: Entity[] = []
let installed = false
export function autoCull(...es: (Entity | undefined)[]) {
  for (const e of es) if (e !== undefined) watched.push(e)
  if (installed) return
  installed = true
  engine.addSystem(() => {
    for (const e of watched) {
      const t = Transform.getOrNull(e)
      if (!t) continue
      const parked = t.position.y < -5 || (t.scale.x === 0 && t.scale.y === 0 && t.scale.z === 0)
      setShown(e, !parked)
    }
  }, 10)
}
