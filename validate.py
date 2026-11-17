#!/usr/bin/env python
"""Re-check the token-radar-01 gate shape against a real out/ directory.

Checks, all from RULES.txt: the board's rows, ranks, order, coverage and plan variety; the dashboard's
files, names and lack of any network address; the dashboard source size; and that dossier.json is what
vendor/makefun-board.ts writes (by running main.ts twice into two clean output directories and
comparing the bytes). Prints every check with its result and exits 1 on any failure.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import hashlib

ROOT = os.path.dirname(os.path.abspath(__file__))
KIT = "C:/script/x/mf-current/token-radar/token-radar-01-kit"
SNAPSHOT = os.path.join(KIT, "input", "snapshot.json")

PLAIN_NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$")
NETWORK = re.compile(r"https?://")
HTML_ATTR = re.compile(r"""(?:href|src|action|srcset|data|poster|formaction)\s*=\s*["']([^"']*)["']""", re.I)
HTML_STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.I | re.S)
JS_SPEC = re.compile(r"""(?:import|export)\s*(?:[^;'"]*?\bfrom\s*)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)""")

results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    return bool(ok)

with open(SNAPSHOT, encoding="utf8") as fh:
    snap = json.load(fh)
protocols = {p["slug"]: p for p in snap["protocols"]}
watchlist = set(snap["watchlist"])
floor = snap["floor_usd"]

out = os.path.join(ROOT, "out")

# ---------------------------------------------------------------- board.json
board_path = os.path.join(out, "board.json")
board = json.load(open(board_path, encoding="utf8")) if os.path.exists(board_path) else None
rows = board["rows"] if isinstance(board, dict) and "rows" in board else board
check("board_file: board.json exists and holds rows", isinstance(rows, list) and len(rows) > 0,
      f"{len(rows) if isinstance(rows, list) else 'no'} rows, {os.path.getsize(board_path) if os.path.exists(board_path) else 0} bytes")
check("board_file: 100..4000 rows", 100 <= len(rows) <= 4000, f"{len(rows)} rows")
check("board_file: under 8 MiB", os.path.getsize(board_path) <= 8 * 1024 * 1024, f"{os.path.getsize(board_path)} bytes")

slugs = [r.get("slug") for r in rows]
unknown = [s for s in slugs if s not in protocols]
check("board_file: every slug is one of the snapshot's protocols", not unknown, f"first unknown: {unknown[:3]}")
dupes = [s for s in set(slugs) if slugs.count(s) > 1]
check("board_file: every slug appears once", not dupes, f"duplicates: {dupes[:3]}")

names_ok = all(isinstance(r.get("name"), str) and r["name"].strip() for r in rows)
check("board_file: every row has a non-empty name", names_ok)

vals = [r.get("implied_value_usd") for r in rows]
values_ok = all(isinstance(v, int) and not isinstance(v, bool) and 0 < v <= 100_000_000_000_000 for v in vals)
check("board_file: implied_value_usd is a positive whole dollar amount, at most $100T", values_ok,
      f"range {min(vals)}..{max(vals)}")
check("sorted_by_value: implied values are not all the same", len(set(vals)) > 1,
      f"{len(set(vals))} distinct values")

ranks = sorted(r.get("rank") for r in rows)
check("sorted_by_value: ranks are exactly 1..N", ranks == list(range(1, len(rows) + 1)),
      f"rank 1..{ranks[-1] if ranks else 0}")
by_rank = sorted(rows, key=lambda r: r["rank"])
monotone = all(by_rank[i]["implied_value_usd"] <= by_rank[i - 1]["implied_value_usd"] for i in range(1, len(by_rank)))
check("sorted_by_value: implied value never rises as rank ascends", monotone)

missing = sorted(watchlist - set(slugs))
check("coverage: every watchlist slug is on the board", not missing, f"missing: {missing[:5]}")
outside = [s for s in slugs if s not in watchlist]
check("coverage: at least 60 rows are outside the watchlist", len(outside) >= 60, f"{len(outside)} rows outside")

steps_ok, step_len_ok, step_texts = True, True, {}
collisions = []
for r in rows:
    steps = r.get("farm_steps")
    if not isinstance(steps, list) or not (3 <= len(steps) <= 12):
        steps_ok = False
        continue
    for s in steps:
        t = s.strip() if isinstance(s, str) else ""
        if not (20 <= len(t) <= 600):
            step_len_ok = False
        owner = step_texts.get(t)
        if owner is not None and owner != r["slug"]:
            collisions.append((r["slug"], owner))
        step_texts[t] = r["slug"]
check("farm_steps: every row holds 3..12 steps", steps_ok)
check("farm_steps: every step is 20..600 characters trimmed", step_len_ok)
check("farm_steps: no step's text is shared by two protocols", not collisions, f"collisions: {collisions[:3]}")

plans = [tuple(r["farm_steps"]) for r in rows]
check("farm_steps: no two rows share a whole plan", len(set(plans)) == len(plans), f"{len(set(plans))} distinct plans")

# ranks must follow implied value, not the array's order
check("sorted_by_value: rank order agrees with implied value order",
      [r["implied_value_usd"] for r in by_rank] == sorted(vals, reverse=True))

# ---------------------------------------------------------------- dashboard/
dash = os.path.join(out, "dashboard")
files = []
for base, dirs, names in os.walk(dash):
    rel = os.path.relpath(base, dash)
    for d in dirs:
        if d.startswith("."):
            check("dashboard_files: no dot-directory", False, os.path.join(rel, d))
    for n in names:
        files.append(os.path.relpath(os.path.join(base, n), dash).replace("\\", "/"))
exts = {os.path.splitext(f)[1].lower() for f in files}
check("dashboard_files: at most 400 files", len(files) <= 400, f"{len(files)} files")
total_bytes = sum(os.path.getsize(os.path.join(dash, f)) for f in files)
check("dashboard_files: at most 4 MiB in all", total_bytes <= 4 * 1024 * 1024, f"{total_bytes} bytes")
check("dashboard_files: index.html, a .css and a .js are present",
      "index.html" in files and ".css" in exts and ".js" in exts, f"{sorted(files)}")
bad_names = [f for f in files if not PLAIN_NAME.match(os.path.basename(f))]
check("dashboard_files: every file name is letters, digits and . _ - (1..128)", not bad_names, f"{bad_names[:3]}")

offenders = []
for f in files:
    path = os.path.join(dash, f)
    if not os.path.isfile(path):
        offenders.append((f, "not a regular file"))
        continue
    if os.path.islink(path):
        offenders.append((f, "is a link"))
        continue
    raw = open(path, "rb").read()
    try:
        text = raw.decode("utf8")
    except UnicodeDecodeError:
        offenders.append((f, "not UTF-8 text"))
        continue
    ext = os.path.splitext(f)[1].lower()
    if ext == ".html":
        for attr in HTML_ATTR.findall(text):
            if NETWORK.search(attr):
                offenders.append((f, f"attribute value {attr[:40]}"))
        for style in HTML_STYLE.findall(text):
            if NETWORK.search(style):
                offenders.append((f, "style body"))
    if ext == ".css" and NETWORK.search(text):
        offenders.append((f, "css file"))
    if ext == ".js":
        for groups in JS_SPEC.findall(text):
            for spec in groups:
                if spec and NETWORK.search(spec):
                    offenders.append((f, f"module specifier {spec[:40]}"))
check("dashboard_files: no http:// or https:// in an attribute, style, css or module specifier",
      not offenders, f"{offenders[:3]}")

source_bytes = sum(os.path.getsize(os.path.join(dash, f)) for f in files)
check("dashboard_files: source under 65,536 bytes so the judge reads it whole", source_bytes < 65536,
      f"{source_bytes} bytes")
print("       dashboard files: " + ", ".join(f"{f} ({os.path.getsize(os.path.join(dash, f))} B)" for f in sorted(files)))

# ---------------------------------------------------------------- screenshots/
shots_dir = os.path.join(out, "screenshots")
shots = sorted(n for n in os.listdir(shots_dir) if not n.startswith(".")) if os.path.isdir(shots_dir) else []
check("screenshots: 3 to 4 images", 3 <= len(shots) <= 4, f"{shots}")
if len(shots) >= 3:
    from PIL import Image
    for n in shots:
        path = os.path.join(shots_dir, n)
        size = os.path.getsize(path)
        with Image.open(path) as im:
            w, h = im.size
            fmt = im.format
        long_side, short_side = max(w, h), min(w, h)
        ok = (300 * 1024 <= size <= 350_000) and fmt in ("PNG", "JPEG") and long_side <= 1440 and short_side >= 800
        check(f"screenshots/{n}: {fmt} {w}x{h}, {size} bytes, 300-350 KB, long<=1440 short>=800", ok)

# ---------------------------------------------------------------- data.js and the two runs
data_js = os.path.join(out, "data.js")
check("dashboard data: data.js is written beside the page", os.path.exists(data_js),
      f"{os.path.getsize(data_js) if os.path.exists(data_js) else 0} bytes")

dossier_a = os.path.join(out, "dossier.json")
if os.path.exists(dossier_a):
    print("       dossier.json: %d bytes" % os.path.getsize(dossier_a))

# main.ts twice into two clean dirs, then compare dossier bytes and the whole tree's bytes
def run_into(target):
    if os.path.isdir(target):
        shutil.rmtree(target)
    os.makedirs(target)
    env = dict(os.environ, MAKEFUN_OUTPUT_DIR=target)
    proc = subprocess.run(
        ["node", "--experimental-strip-types", "main.ts", "--input", SNAPSHOT],
        cwd=ROOT, env=env, capture_output=True, text=True)
    return proc

if os.environ.get("SKIP_RERUN") != "1":
    a, b = os.path.join(ROOT, ".qa-out-a"), os.path.join(ROOT, ".qa-out-b")
    pa, pb = run_into(a), run_into(b)
    check("main.ts: run 1 exits 0", pa.returncode == 0, (pa.stdout or pa.stderr).strip().splitlines()[-1][:120] if (pa.stdout or pa.stderr) else "")
    check("main.ts: run 2 exits 0", pb.returncode == 0, (pb.stdout or pb.stderr).strip().splitlines()[-1][:120] if (pb.stdout or pb.stderr) else "")
    da, db = os.path.join(a, "dossier.json"), os.path.join(b, "dossier.json")
    ba, bb = open(da, "rb").read(), open(db, "rb").read()
    same = ba == bb
    check("dossier_matches: the two runs write the same dossier bytes", same,
          f"sha256 {hashlib.sha256(ba).hexdigest()[:16]} vs {hashlib.sha256(bb).hexdigest()[:16]}, {len(ba)} vs {len(bb)} bytes")
    check("dossier_matches: out/dossier.json is the same dossier",
          os.path.exists(dossier_a) and open(dossier_a, "rb").read() == ba)
    check("dossier_matches: under 1.5 MiB", len(ba) <= int(1.5 * 1024 * 1024), f"{len(ba)} bytes")
    # every other output file must match too
    names = set(os.listdir(a)) | set(os.listdir(b))
    diff = []
    for n in sorted(names):
        pa_, pb_ = os.path.join(a, n), os.path.join(b, n)
        if os.path.isfile(pa_) and os.path.isfile(pb_):
            if open(pa_, "rb").read() != open(pb_, "rb").read():
                diff.append(n)
    check("the two runs write the same bytes outside dashboard/ and screenshots/", not diff, f"differing: {diff}")
    shutil.rmtree(a, ignore_errors=True)
    shutil.rmtree(b, ignore_errors=True)

failed = [n for n, ok, _ in results if not ok]
print()
print(f"{len(results) - len(failed)}/{len(results)} checks pass")
if failed:
    print("FAILED: " + "; ".join(failed))
    sys.exit(1)
print("the gate shape holds")
