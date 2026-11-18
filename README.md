# Bayou — Open World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sswi6484/gta6-bayou/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sswi6484/gta6-bayou/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for [make.fun gta6-01](https://make.fun/bounty/gta6-01).

**Gator Bend** is a swamp river-delta town on the water's edge — levee roads,
bayous and backwaters, stilt houses, shrimp boats, a riverfront shanty town and
fog over the cypress groves. You are **Remy "Catfish" Broussard**, a riverboat
smuggler who owes **Mama Odette**, the bayou boss. **Sheriff Delacroix** wants
your plate.

## What is in the game

- **An open world to explore on foot, by car and by boat** — the river and the
  bayou channels are the fast way around; the levee roads are the dry one.
- **Five story missions** ($150–$1,000): First Haul, Fog Run, Levee Dodge
  (dodge the sheriff checkpoint on the Main Street bridge), Hot Pursuit (lose
  wanted 3, then slip into the safehouse), The Big Haul (three drops with the
  heat on).
- **Side work**: 12 swamp caches (+$25) and a river time trial — 6 gates down
  the river in 95 seconds ($150).
- **Wanted level 0–5** with police cruisers on the roads and police boats on
  the river; busted and wasted recoveries; fuel to manage (refuel at Gas & Go
  or the Marina).
- **Traffic and pedestrians**, cars to steal and drive, boats to board, a HUD
  with a minimap, localStorage save, and synthesized WebAudio (engine, siren,
  jingles — no audio files).
- **Swamp fog and a day/night cycle**: the fog rolls over the groves, and at
  night your headlights are the only light on the river.

## Controls

WASD / arrows — drive, sail and walk • E — enter & exit a vehicle • F — refuel
near Gas & Go or the Marina • Space — handbrake / confirm • P — pause •
M — mute

## Play it

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Static files only — `game/index.html` opens in desktop Chrome with no network
requests. `main.ts` (Node 22 stdlib) copies `game/` and `screenshots/` to
`/output` and writes `dossier.json`.

## License

MIT — see [LICENSE](LICENSE).
