# Token Radar — a pre-token launch radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/meimekh/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/meimekh/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An entry for [make.fun](https://make.fun)'s **token-radar-01** bounty. It reads the sealed DefiLlama
snapshot once and ranks every protocol whose record carries **no token yet** by an **implied value**,
with a concrete farm plan for each one.

## What it does

* **Ranks the pre-token universe, not just the watchlist.** The house watchlist (40 protocols above
  $50M of TVL with no token on record) is the floor of the board, never its ceiling: the board carries
  every protocol the snapshot records with no token that is not a product of one that already trades —
  **195 rows** on this snapshot, **155 of them outside the watchlist**.
* **Separates what trades from what is still to come.** A protocol whose token already trades is never
  scored: its market cap is a fact, so those protocols are shown beside the board with their own number
  and their own token-status filter, and they hold no rank.
* **States its own model.** Implied value comes from the snapshot's own ten fields and nothing else —
  no protocol is special-cased, and the dashboard prints the formula, the constants, the category
  table and every assumption behind them, for the reader to judge.
* **Gives every row a real plan.** Each farm plan is generated from that protocol's own category,
  chains, TVL, seven-day change and age, with what each step costs (gas, capital, lock-up) and how long
  it takes. Two protocols never share a plan.
* **No network, no framework, no build step.** The page is `index.html`, one stylesheet and three
  plain scripts; its data is the `data.js` the program writes beside it.

## The model

```
implied  = round( size x growth x maturity x category x breadth )

size     = tvl_usd x 0.22
growth   = 1 + 0.6 x ln(1 + clamp(change_7d, -60, 120) / 100)
maturity = 0.55 + min(age_days, 1095) / 1095 x 0.45        (age unknown: 365 days)
category = the value-capture multiple of the protocol's own category
breadth  = 1 + 0.12 x min(ln(chains) / ln(5), 1)
```

Growth is logarithmic and clamped, so one violent week cannot invent a price; maturity rises with the
time the snapshot has tracked the protocol with no token on record and then saturates; breadth rewards
distribution up to five chains and then stops. A separate **confidence** score (0–100) reports how much
of the record backs each estimate and never moves a rank.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Node 22 (the grader's Node 22.18+ strips the TypeScript itself; a local 22.15 needs
`--experimental-strip-types`). The program writes `out/board.json`, `out/data.js`, copies `dashboard/`
and `screenshots/` there, and writes `out/dossier.json` with `buildDossier` from
`vendor/makefun-board.ts`.

## Layout

| Path | What it holds |
| --- | --- |
| `main.ts` | Reads the snapshot, writes the board, the data script and the dossier. |
| `lib/model.ts` | The model: the board's selection rules, implied value, confidence, the gate guard. |
| `lib/farm.ts` | The farm-plan generator: one plan per protocol, from its category and figures. |
| `dashboard/` | The page: `index.html`, `app.css`, `model.js`, `plan.js`, `app.js`. |
| `screenshots/` | The board, a detail view and a filtered view, rendered from the page. |
| `vendor/makefun-board.ts` | make.fun's dossier library, byte for byte as shipped. |
| `validate.py`, `shots.py` | The QA harness: the gate shape, and the browser checks and screenshots. |
| `QA.md` | The real output of both, and what could not be verified here. |

Licensed under the MIT License (see `LICENSE`).
