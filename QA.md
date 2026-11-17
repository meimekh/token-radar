# QA — what was run, and what it printed

Everything below is real output from this machine, in this session. Nothing here is estimated.

* **Session:** `20261117_130712_0623db` (Hermes, model `harbor` via a custom provider, working
  directory `C:\script\x\entries\token-radar-01`).
* **Machine:** Windows 10, git-bash shell, Node `v22.15.0`, Python `3.11.9`, Pillow `12.2.0`,
  Playwright's Chromium `148.0.7778.96`.
* **Snapshot:** `C:/script/x/mf-current/token-radar/token-radar-01-kit/input/snapshot.json`
  (`as_of` 2026-11-14, 758 protocols, watchlist 40, floor $50,000,000).

## 1. The program, run for real

```
$ mkdir -p out && MAKEFUN_OUTPUT_DIR=out node --experimental-strip-types main.ts \
      --input C:/script/x/mf-current/token-radar/token-radar-01-kit/input/snapshot.json
token radar: 758 protocols, 40 on the watchlist, 195 rows scored (155 early, 402 live set aside)
token radar: wrote out\board.json, out\data.js, out\dashboard (3 files), out\screenshots (3 images) and out\dossier.json
```

`main.ts` is unchanged from the starter's contract; the local `--experimental-strip-types` flag is the
runner's, not the program's (the grader's Node 22.18+ strips natively).

## 2. The gate shape, re-checked — `python validate.py`

```
[PASS] board_file: board.json exists and holds rows — 195 rows, 489188 bytes
[PASS] board_file: 100..4000 rows — 195 rows
[PASS] board_file: under 8 MiB — 489188 bytes
[PASS] board_file: every slug is one of the snapshot's protocols — first unknown: []
[PASS] board_file: every slug appears once — duplicates: []
[PASS] board_file: every row has a non-empty name
[PASS] board_file: implied_value_usd is a positive whole dollar amount, at most $100T — range 571942..517663683
[PASS] sorted_by_value: implied values are not all the same — 195 distinct values
[PASS] sorted_by_value: ranks are exactly 1..N — rank 1..195
[PASS] sorted_by_value: implied value never rises as rank ascends
[PASS] coverage: every watchlist slug is on the board — missing: []
[PASS] coverage: at least 60 rows are outside the watchlist — 155 rows outside
[PASS] farm_steps: every row holds 3..12 steps
[PASS] farm_steps: every step is 20..600 characters trimmed
[PASS] farm_steps: no step's text is shared by two protocols — collisions: []
[PASS] farm_steps: no two rows share a whole plan — 195 distinct plans
[PASS] sorted_by_value: rank order agrees with implied value order
[PASS] dashboard_files: at most 400 files — 5 files
[PASS] dashboard_files: at most 4 MiB in all — 64173 bytes
[PASS] dashboard_files: index.html, a .css and a .js are present — ['app.css', 'app.js', 'index.html', 'model.js', 'plan.js']
[PASS] dashboard_files: every file name is letters, digits and . _ - (1..128) — []
[PASS] dashboard_files: no http:// or https:// in an attribute, style, css or module specifier — []
[PASS] dashboard_files: source under 65,536 bytes so the judge reads it whole — 64173 bytes
       dashboard files: app.css (11830 B), app.js (30545 B), index.html (596 B), model.js (6505 B), plan.js (14697 B)
[PASS] screenshots: 3 to 4 images — ['1-board.png', '2-detail.png', '3-filtered.png']
[PASS] screenshots/1-board.png: PNG 1440x900, 348558 bytes, 300-350 KB, long<=1440 short>=800
[PASS] screenshots/2-detail.png: PNG 1440x900, 308487 bytes, 300-350 KB, long<=1440 short>=800
[PASS] screenshots/3-filtered.png: PNG 1440x900, 347167 bytes, 300-350 KB, long<=1440 short>=800
[PASS] dashboard data: data.js is written beside the page — 172224 bytes
       dossier.json: 1405396 bytes
[PASS] main.ts: run 1 exits 0
[PASS] main.ts: run 2 exits 0
[PASS] dossier_matches: the two runs write the same dossier bytes — sha256 05e6fd1ee74e1918 vs 05e6fd1ee74e1918, 1405396 vs 1405396 bytes
[PASS] dossier_matches: out/dossier.json is the same dossier
[PASS] dossier_matches: under 1.5 MiB — 1405396 bytes
[PASS] the two runs write the same bytes outside dashboard/ and screenshots/ — differing: []

34/34 checks pass
the gate shape holds
```

The last four checks run `main.ts` twice into two clean directories (`.qa-out-a`, `.qa-out-b`) and
compare the bytes, so `dossier.json` is what `buildDossier('/output', {text_max_bytes: 65536})` writes
from what the program produces. The dossier's own text is **64,583 bytes**, uncut: all five dashboard
files appear whole (checked for the `[Cut at …]` line).

## 3. The page in a real browser — `python shots.py`

```
[PASS] the page parses the data — model radar-2, 195 ranked rows, 133 live rows with a market cap
[PASS] the page's model reproduces every implied value in board.json — 195 rows checked, mismatches: []
[PASS] the page's plan generator reproduces every farm plan in board.json — 195 plans checked, mismatches: []
[PASS] filter {"status": "pre"} — page 195 vs expected 195
[PASS] filter {"status": "live"} — page 133 vs expected 133
[PASS] filter {"status": "all"} — page 328 vs expected 328
[PASS] filter {"status": "all", "q": "solana"} — page 47 vs expected 47
[PASS] filter {"status": "all", "q": "no-such-protocol-zzz"} — page 0 vs expected 0
[PASS] filter {"status": "pre", "category": "Risk Curators"} — page 34 vs expected 34
[PASS] filter {"status": "pre", "chain": "Base"} — page 39 vs expected 39
[PASS] filter {"status": "all", "chain": "Solana", "sort": "confidence"} — page 47 vs expected 47
[PASS] sorting by confidence returns a non-increasing column
[PASS] clicking a row opens its detail view — Sentora Curator: 6 arithmetic lines, 8 plan steps
[PASS] the filtered view renders the rows the filter keeps — "29 of 328 protocols shown"; 29 rows in the table
[PASS] no console error from the page — errors [], console []
[PASS] the page requests nothing outside its own origin — 6 requests
[PASS] the page loads only its own files — ['.../dashboard/app.css', '.../dashboard/app.js', '.../dashboard/index.html', '.../dashboard/model.js', '.../dashboard/plan.js', '.../data.js']

[PASS] screenshots/1-board.png: PNG 1440x900, 348558 bytes (2x render resized to 1440x900 (LANCZOS))
[PASS] screenshots/2-detail.png: PNG 1440x900, 308487 bytes (2x render resized to 1440x900 (BICUBIC))
[PASS] screenshots/3-filtered.png: PNG 1440x900, 347167 bytes (2x render resized to 1440x900 (LANCZOS))

ALL CHECKS PASS
```

What the browser run establishes, concretely:

* the page is served from `out/` over loopback and opened at a 1440x900 viewport;
* `window.__radarTest` drives the same functions the page renders with: `model`, `farmSteps`, `filter`,
  `sort`, `setState` — the page's model reproduces all **195** implied values and all **195** farm
  plans in `board.json`, character for character;
* the filters answer as an independent Python re-implementation of the same rules expects, over the
  same data (search, category, chain, token status), the sort column comes back ordered, clicking a row
  opens the detail view with 6 arithmetic lines and 8 plan steps, and the filtered view renders exactly
  the rows its own counter reports;
* the page raises **no console error** and makes **no request off its own origin** — six requests in
  all: the document, its stylesheet, its three scripts and `data.js`.

### The three screenshots

| File | Bytes | Pixels | How it was produced |
| --- | --- | --- | --- |
| `screenshots/1-board.png` (cover) | 348,558 | 1440x900 PNG | the board at its default state |
| `screenshots/2-detail.png` | 308,487 | 1440x900 PNG | a row clicked open: figures, arithmetic, confidence, plan |
| `screenshots/3-filtered.png` | 347,167 | 1440x900 PNG | category + chain + token-status filters, sorted by confidence |

Each is a real Chromium render of this dashboard, whole and never composited. Rendered at 1x the pages
came out below the 300 KB floor the brief asks for, so each was captured at 2x device pixels and
resized down to 1440x900 (a resize of the same render), which lands inside 300–350 KB; the JPEGs and
PNGs were never edited, and no image was drawn or borrowed.

## 4. What still fails, and what could not be verified here

* **Nothing failed.** 34/34 gate-shape checks and 20/20 browser checks pass on the artifact in `out/`.
* **No local grade exists.** token-radar-01 is graded by make.fun's sealed, server-side scorer and
  judge; there is no local score to report. This session did not submit anything, by instruction.
* **The "top leaderboard" outcome cannot be verified.** Whether the entry places cannot be checked
  here: it depends on the sealed judge's pairwise verdicts. What can be checked — validity, coverage,
  the model's agreement with its data, the plan variety and the page's behaviour — passes as above.
* **The transcript gate is outside this run.** The brief for this session covers the artifact only, so
  no transcript bundle was built and no run record was written; that step belongs to the submission.
* **Screenshot banding is a post-step.** The renders are captured at 2x and resized to 1440x900 to land
  in the 300–350 KB band, as the brief allows; at 1x they are roughly 210–260 KB (below the floor),
  which is why the resize is used.
* **Two small limits of the data itself.** The live set shows only protocols whose record carries both
  an id and a market cap (133 of 402 live protocols have a market cap, the rest are shown nowhere but
  never ranked); and 19 ranked rows have no `listed_at`, so the model assumes 365 days for them and
  says so in their detail view and confidence breakdown.
