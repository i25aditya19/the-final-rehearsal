# Headless playtest

Runs the real scene code (`src/index.ts`) in Node with a scripted bot that only uses what a
player can see (floor telegraphs, rune colours), moves at a set speed, reacts with a delay and aims
with error. Three profiles (novice / average / skilled).

    NODE_PATH=sim/node_path npx tsx sim/fight.ts 5

`sim/node_path/~system/*` are minimal stand-ins for renderer modules the SDK imports; they are
only used here, never in the scene. The bot knows the optimal strategy from the start, so real
first-time players will be slower: treat its times as a lower bound.
