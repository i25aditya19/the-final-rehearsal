// Runtime census: what the scene creates (primitives by shape, hidden pooled meshes, GLBs).
import { engine, Entity, MeshRenderer, GltfContainer, Transform, ParticleSystem, LightSource, VisibilityComponent } from '@dcl/sdk/ecs'
import { main } from '../src/index'
async function run() {
  main()
  for (let i = 0; i < 60; i++) await engine.update(1 / 30)
  const shapes: Record<string, number> = {}
  let hidden = 0
  let entities = 0
  for (const [e] of engine.getEntitiesWith(Transform)) entities++
  for (const [e, m] of engine.getEntitiesWith(MeshRenderer)) {
    const k = m.mesh?.$case ?? 'none'
    shapes[k] = (shapes[k] ?? 0) + 1
    const t = Transform.get(e)
    // walk parents to see if hidden (scale 0 or far below)
    let p: any = t, hid = false, guard = 0
    while (p && guard++ < 10) { if (p.scale.x === 0 || p.position.y < -5) { hid = true; break } p = p.parent ? Transform.getOrNull(p.parent) : undefined }
    if (hid) hidden++
  }
  // culled = self or an ancestor has VisibilityComponent { visible:false } (renderer skips it)
  const culledFn = (e: Entity) => { let cur: Entity | undefined = e, g = 0; while (cur !== undefined && g++ < 12) { const v = VisibilityComponent.getOrNull(cur); if (v && v.visible === false) return true; const t = Transform.getOrNull(cur); cur = t?.parent as Entity | undefined } return false }
  let culledPrims = 0, culledGltf = 0
  for (const [e] of engine.getEntitiesWith(MeshRenderer)) if (culledFn(e)) culledPrims++
  const gltf: Record<string, number> = {}
  for (const [e, g] of engine.getEntitiesWith(GltfContainer)) { gltf[g.src] = (gltf[g.src] ?? 0) + 1; if (culledFn(e)) culledGltf++ }
  console.log(JSON.stringify({ runtimeEntities: entities, primitives: shapes, hiddenPrimitives: hidden, culledPrimitives: culledPrims, culledGltf, gltfRuntime: gltf, particles: [...engine.getEntitiesWith(ParticleSystem)].length, lights: [...engine.getEntitiesWith(LightSource)].length }, null, 1))
}
run()
