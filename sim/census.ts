// Runtime census: what the scene creates (primitives by shape, hidden pooled meshes, GLBs).
import { engine, MeshRenderer, GltfContainer, Transform, ParticleSystem, LightSource } from '@dcl/sdk/ecs'
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
  const gltf: Record<string, number> = {}
  for (const [, g] of engine.getEntitiesWith(GltfContainer)) gltf[g.src] = (gltf[g.src] ?? 0) + 1
  console.log(JSON.stringify({ runtimeEntities: entities, primitives: shapes, hiddenPrimitives: hidden, gltfRuntime: gltf, particles: [...engine.getEntitiesWith(ParticleSystem)].length, lights: [...engine.getEntitiesWith(LightSource)].length }, null, 1))
}
run()
