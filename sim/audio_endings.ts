// Audio check for endings and restarts: real scene, forced defeat, wait, retry; logs the mix.
// run: NODE_PATH=sim/node_path npx tsx sim/audio_endings.ts
import { AudioSource, engine } from '@dcl/sdk/ecs'
import { main } from '../src/index'
import { state } from '../src/game/state'
import { retry } from '../src/game/session'
import { audioDebug, audioSettings } from '../src/audio/audio'
const orig = AudioSource.playSound.bind(AudioSource)
const started: string[] = []
;(AudioSource as any).playSound = (e: any, src: string) => { started.push(`${state.time.toFixed(1)}:${src.slice(13, -4)}`); return orig(e, src) }
async function step(sec: number) { for (let i = 0; i < sec * 30; i++) await engine.update(1 / 30) }
async function run() {
  main()
  await step(10)
  console.log('active t=10', JSON.stringify(audioDebug()))
  state.playerHp = 1
  ;(await import('../src/game/state')).damagePlayer(999, 'test')
  await step(3)
  console.log('defeat +3s', state.phase, JSON.stringify(audioDebug()))
  await step(10)
  console.log('defeat +13s', JSON.stringify(audioDebug()))
  retry(); await step(1)
  console.log('retry +1s', state.phase, JSON.stringify(audioDebug()))
  await step(9)
  console.log('retry +10s', JSON.stringify(audioDebug()))
  audioSettings.muted = true; await step(1)
  console.log('muted', JSON.stringify(audioDebug()))
  audioSettings.muted = false; audioSettings.music = 0.4; await step(4)
  console.log('music 40%', JSON.stringify(audioDebug()))
  console.log('sources with AudioSource:', [...engine.getEntitiesWith(AudioSource)].length)
  console.log('started:', started.join(' '))
}
run()
