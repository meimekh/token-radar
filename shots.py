#!/usr/bin/env python
"""Drive the dashboard in a real browser: check it against board.json, then take the three screenshots.

Serves out/ over http on loopback, opens dashboard/index.html in Chromium at 1440x900, checks that the
page's own model and plan generator reproduce board.json row for row, that the filters and the sort
behave, that no console error and no off-origin request happens, then writes 1-board.png, 2-detail.png
and 3-filtered.png as whole 1440x900 PNGs in the 300-350 KB band, and prints every measurement.

A screenshot is saved exactly as rendered when it already lands in the band. Otherwise the same render
is taken at two device pixels per CSS pixel and resized down to 1440x900 (the render is resized, never
composited), and the PNG's zlib level is swept, which changes no pixel.
"""
import io
import json
import os
import re
import socket
import sys
import threading
import http.server
import functools

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "out")
SHOTS = os.path.join(ROOT, "screenshots")
VIEW = {"width": 1440, "height": 900}
LO, HI = 300 * 1024, 350_000  # 300 KiB .. 350,000 bytes: inside the band under either reading of KB

board = json.load(open(os.path.join(OUT, "board.json"), encoding="utf8"))["rows"]
data_js = open(os.path.join(OUT, "data.js"), encoding="utf8").read()
radar = json.loads(re.search(r"window\.RADAR=(.*);\s*$", data_js, re.S).group(1))
by_slug = {r["slug"]: r for r in board}

rows, live = radar["rows"], radar["live"]
live_with_mcap = [r for r in live if r["mcap_usd"] is not None]


def hay(r):
    return " ".join([r["name"], r["slug"], r.get("category") or "", r.get("symbol") or "", " ".join(r["chains"])]).lower()


def filt(rows_, status, q="", category="all", chain="all"):
    out = []
    for r in rows_:
        kind = r.get("kind") or ("live" if r.get("token_status") == "live" else "pre")
        if status == "pre" and kind != "pre":
            continue
        if status == "live" and kind != "live":
            continue
        if category != "all" and (r.get("category") or "Other") != category:
            continue
        if chain != "all" and chain not in r["chains"]:
            continue
        if q and q.lower() not in hay(r):
            continue
        out.append(r)
    return out


allrows = [dict(r, kind="pre") for r in rows] + [dict(r, kind="live") for r in live_with_mcap]
CASES = [
    {"status": "pre"},
    {"status": "live"},
    {"status": "all"},
    {"status": "all", "q": "solana"},
    {"status": "all", "q": "no-such-protocol-zzz"},
    {"status": "pre", "category": "Risk Curators"},
    {"status": "pre", "chain": "Base"},
    {"status": "all", "chain": "Solana", "sort": "confidence"},
]
expected = [len(filt(allrows, c.get("status", "pre"), c.get("q", ""), c.get("category", "all"), c.get("chain", "all"))) for c in CASES]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=OUT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{PORT}"
url = f"{origin}/dashboard/index.html"

console, errors, requests = [], [], []
os.makedirs(SHOTS, exist_ok=True)
for name in os.listdir(SHOTS):
    os.remove(os.path.join(SHOTS, name))

failures = []


def check(name, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(name)
    return ok


def fit_png(candidates, path):
    """Land one screenshot in the 300-350 KB band; candidates are (label, png bytes), best first."""
    refused = []
    for label, raw in candidates:
        if LO <= len(raw) <= HI:
            open(path, "wb").write(raw)
            return len(raw), label
        with Image.open(io.BytesIO(raw)) as im:
            im = im.convert("RGB")
            for level in (9, 8, 7, 6, 5, 4, 3, 2, 1, 0):
                buf = io.BytesIO()
                im.save(buf, "PNG", compress_level=level, optimize=False)
                if LO <= buf.tell() <= HI:
                    open(path, "wb").write(buf.getvalue())
                    return buf.tell(), f"{label}, lossless re-encode (zlib {level})"
        refused.append((label, len(raw)))
        if not os.path.exists(path):
            open(path, "wb").write(raw)
    return os.path.getsize(path), f"out of band: {refused}"


from playwright.sync_api import sync_playwright

shots = {}
with sync_playwright() as p:
    browser = p.chromium.launch()

    def shot_candidates(fragment="", selector=None):
        """The same page state, captured at several pixel densities and resized to 1440x900."""
        out = []
        for dsf, resample in ((1, None), (2, Image.Resampling.LANCZOS), (2, Image.Resampling.BICUBIC), (1.5, Image.Resampling.LANCZOS)):
            ctx = browser.new_context(viewport=VIEW, device_scale_factor=dsf)
            pg = ctx.new_page()
            pg.goto(url + fragment, wait_until="load")
            pg.wait_for_selector("#board-panel tbody tr", timeout=15000)
            if selector:
                pg.wait_for_selector(selector, timeout=8000)
            pg.wait_for_timeout(350)
            raw = pg.screenshot()
            ctx.close()
            if resample is None:
                out.append(("as rendered at 1x, 1440x900", raw))
            else:
                with Image.open(io.BytesIO(raw)) as im:
                    small = im.convert("RGB").resize((VIEW["width"], VIEW["height"]), resample)
                buf = io.BytesIO()
                small.save(buf, "PNG")
                out.append((f"{dsf}x render resized to 1440x900 ({resample.name})", buf.getvalue()))
        return out

    context = browser.new_context(viewport=VIEW, device_scale_factor=1)
    page = context.new_page()
    page.on("console", lambda m: console.append((m.type, m.text)))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: requests.append(r.url))
    page.goto(url, wait_until="load")
    page.wait_for_selector("#board-panel tbody tr", timeout=15000)
    page.wait_for_timeout(400)

    hook = page.evaluate("() => ({version: window.__radarTest.modelVersion, rows: window.__radarTest.rows.length, live: window.__radarTest.live.length})")
    check("the page parses the data", hook["rows"] == len(board) and hook["live"] == len(live_with_mcap),
          f"model {hook['version']}, {hook['rows']} ranked rows, {hook['live']} live rows with a market cap")

    cmp = page.evaluate("""(board) => {
        const t = window.__radarTest;
        const by = {}; board.forEach(r => { by[r.slug] = r; });
        const modelBad = [], planBad = [];
        t.rows.forEach(r => {
          const m = t.model(r);
          if (m.implied !== by[r.slug].implied_value_usd) modelBad.push([r.slug, m.implied, by[r.slug].implied_value_usd]);
          const plan = t.farmSteps(r);
          const want = by[r.slug].farm_steps;
          if (plan.length !== want.length || plan.some((s, i) => s !== want[i])) planBad.push(r.slug);
        });
        return { modelBad: modelBad.slice(0, 3), planBad: planBad.slice(0, 3), checked: t.rows.length };
    }""", board)
    check("the page's model reproduces every implied value in board.json", not cmp["modelBad"],
          f"{cmp['checked']} rows checked, mismatches: {cmp['modelBad']}")
    check("the page's plan generator reproduces every farm plan in board.json", not cmp["planBad"],
          f"{cmp['checked']} plans checked, mismatches: {cmp['planBad']}")

    got = page.evaluate("""(cases) => {
        const t = window.__radarTest;
        const all = t.rows.concat(t.live);
        return cases.map(c => t.filter(all, Object.assign({q: '', category: 'all', chain: 'all', status: 'pre', sort: 'implied'}, c)).length);
    }""", CASES)
    for case, want, have in zip(CASES, expected, got):
        check(f"filter {json.dumps(case)}", want == have, f"page {have} vs expected {want}")

    check("sorting by confidence returns a non-increasing column", page.evaluate("""() => {
        const t = window.__radarTest;
        const vals = t.sort(t.rows, {sort: 'confidence', dir: -1}).map(r => r.confidence);
        return vals.every((v, i) => i === 0 || vals[i - 1] >= v);
    }"""))

    # 1. the board, as it lands
    page.evaluate("() => window.__radarTest.setState({q: '', category: 'all', chain: 'all', status: 'pre', sort: 'implied', dir: -1})")
    page.wait_for_timeout(250)
    shots["1-board.png"] = fit_png(shot_candidates(), os.path.join(SHOTS, "1-board.png"))

    # 2. a protocol's detail view, opened by clicking its row
    second = page.evaluate("() => window.__radarTest.rows[1].slug")
    page.click(f'tr[data-slug="{second}"]')
    page.wait_for_selector("#detail[open] #detail-title", timeout=5000)
    title = page.inner_text("#detail-title")
    steps = page.eval_on_selector_all("#detail .steps li", "els => els.length")
    lines = page.eval_on_selector_all("#detail .arithmetic li", "e => e.length")
    check("clicking a row opens its detail view", title == by_slug[second]["name"] and steps == 8 and lines == 6,
          f"{title}: {lines} arithmetic lines, {steps} plan steps")
    page.wait_for_timeout(250)
    shots["2-detail.png"] = fit_png(shot_candidates(f"#p={second}", "#detail[open] #detail-title"), os.path.join(SHOTS, "2-detail.png"))

    # 3. a filtered view: category, chain, token status and a different sort
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    page.evaluate("""() => window.__radarTest.setState({q: '', category: 'Risk Curators', chain: 'Ethereum', status: 'all', sort: 'confidence', dir: -1})""")
    page.wait_for_timeout(300)
    shown = page.inner_text(".count")
    rows_dom = page.eval_on_selector_all("#board-panel tbody tr:not(.divider)", "e => e.length")
    check("the filtered view renders the rows the filter keeps", int(shown.split(" ")[0]) == rows_dom and rows_dom > 0,
          f'"{shown}"; {rows_dom} rows in the table')
    shots["3-filtered.png"] = fit_png(shot_candidates("#category=Risk%20Curators&chain=Ethereum&status=all&sort=confidence"), os.path.join(SHOTS, "3-filtered.png"))

    browser.close()

httpd.shutdown()

check("no console error from the page", not errors and not [m for m in console if m[0] == "error"],
      f"errors {errors[:2]}, console {[m for m in console if m[0] == 'error'][:2]}")
check("the page requests nothing outside its own origin", not [u for u in requests if not u.startswith(origin)],
      f"{len(requests)} requests")
check("the page loads only its own files",
      sorted(set(requests)) == sorted([url, f"{origin}/data.js", f"{origin}/dashboard/app.css", f"{origin}/dashboard/model.js", f"{origin}/dashboard/plan.js", f"{origin}/dashboard/app.js"]),
      str(sorted(set(requests))))

print()
for name in ("1-board.png", "2-detail.png", "3-filtered.png"):
    path = os.path.join(SHOTS, name)
    size, how = shots.get(name, (0, "missing"))
    with Image.open(path) as im:
        w, h = im.size
        fmt = im.format
    check(f"screenshots/{name}: {fmt} {w}x{h}, {size} bytes ({how})",
          fmt == "PNG" and LO <= size <= HI and max(w, h) <= 1440 and min(w, h) >= 800)

print()
print("ALL CHECKS PASS" if not failures else "FAILED: " + "; ".join(failures))
sys.exit(1 if failures else 0)
