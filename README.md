# THE FINAL REHEARSAL

*Every spell leaves a trace. Every trace is being watched.*

A five-minute final boss fight in Decentraland. Every spell you cast leaves a spectral **echo** that repeats it. Arrange your echoes around **The Watcher, Keeper of Unforgotten Moments**, then synchronize them into a **Convergence** to break his defenses.

Built for the **GAME OVER 2026** game jam (DCL Regenesis Labs) with Decentraland SDK7.

- **World:** `rgl10.dcl.eth` (not yet deployed)
- **Status:** see [`docs/STATUS.md`](docs/STATUS.md)
- **Design brief:** [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)

## Controls (planned, verified in M1)

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look / aim |
| Left click | **Imprint**: cast a spell that leaves an echo |
| E | **Convergence**: fire all ready echoes together |
| Space | Jump |

## Run locally (macOS)

Requires Node.js 18+.

```bash
git clone https://github.com/i25aditya19/the-final-rehearsal.git
cd the-final-rehearsal
npm install
npm run start      # opens a local preview
```

You can also open the folder in the [Decentraland Creator Hub](https://decentraland.org/download/creator-hub) and click **Preview**.

`npm run build` type-checks and bundles the scene.

## Project layout

```
src/index.ts      entry point (main)
src/config.ts     all tuning values (damage, timings, arena size)
src/ui.tsx        HUD
assets/           models, audio, textures (see docs/ASSETS.md for licenses)
docs/             design brief, status, asset credits
scene.json        3x3 parcels, World configuration
```

## License

Source code: [MIT](LICENSE). Third-party assets keep their own licenses; see [`docs/ASSETS.md`](docs/ASSETS.md).
