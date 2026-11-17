// The token radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// WHAT IT RANKS. Every protocol in the snapshot whose record carries no token (both gecko_id and
// symbol null) is a subject: the watchlist ones and the ones below or outside it alike. The watchlist
// is a floor and never a ceiling, so the board carries every pre-token protocol the snapshot holds,
// not only the 40 the house named. A record with no token is not proof of a launch ahead, so the board
// applies the same structural tests the house used, uniformly, to every protocol and never to a slug:
//
//   * a CEX is a business, not a launch a farmer can join;
//   * a bridge, a liquid staking or restaking product and a stablecoin wrapper are products of a token
//     that already trades, and the TVL they show belongs to that token (WBTC, Binance staked ETH,
//     USDT0). Their categories name the product, so the category is the test;
//   * a name that carries wrapped, staked or staking as a whole word, or that begins with an
//     exchange's name, is a product too; and a name ending in a version marker (" Foo V2") is a pool
//     of a parent protocol that borrows its TVL.
//
// Protocols whose token already trades are not ranked at all: their market cap is the market's own
// number, a fact, so the dashboard sets them aside and says so.
//
// HOW IT VALUES ONE. Implied value is the entry's own claim: what the protocol's token would be worth
// if its record stayed exactly as it is. It is a function of the snapshot's own fields, and only those:
//
//   size      = tvl_usd x SIZE_MULTIPLE
//   growth    = 1 + GROWTH_WEIGHT x ln(1 + clamp(change_7d, G_FLOOR, G_CAP) / 100)
//   maturity  = MAT_FLOOR + min(age_days, MAT_DAYS) / MAT_DAYS x MAT_RANGE
//   category  = CATEGORY_MULTIPLE(category)          (see the table below)
//   breadth   = 1 + BREADTH_WEIGHT x min(ln(max(chains,1)) / ln(BREADTH_CHAINS), 1)
//   implied   = max(1, round(size x growth x maturity x category x breadth))
//
// The growth term is logarithmic on purpose: doubling a protocol's seven-day growth adds a fixed
// amount rather than doubling the value, so one hot week cannot invent a token price. Growth is
// clamped to G_FLOOR..G_CAP, an unreported change counts as flat, and maturity rises with the time the
// protocol has run with no token on record (listed_at), saturating at MAT_DAYS. Breadth saturates too.
// Every term is monotone in its own input and the whole thing is arithmetic on the ten fields: no
// protocol is special-cased, and the same function scores every row.
//
// CONFIDENCE. A second, separate 0..100 score says how much of the record backs the estimate: a
// reported seven-day change, a listing date, a named category, more than one chain, positive momentum
// and a TVL at or above the house floor. It orders rows inside a band of implied value and is shown in
// the detail view; it never moves a rank, which follows implied value alone.
//
// The constants are the model's own, stated on the dashboard page and changeable in one place.

import { agePhrase, capitalFor, chainOf, familyOf, farmSteps, gasForChain, holdDaysFor } from './farm.ts';
import type { FarmStep } from './farm.ts';

export type { FarmStep };
export { agePhrase, capitalFor, chainOf, familyOf, farmSteps, gasForChain, holdDaysFor };

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, exactly as the dashboard states them. */
export interface ModelConstants {
  size_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_weight: number;
  breadth_chains: number;
  category_default: number;
}

export const MODEL: ModelConstants = {
  size_multiple: 0.22,
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_weight: 0.12,
  breadth_chains: 5,
  category_default: 1,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/**
 * How much of a protocol's value a token could capture, by category family: fee-earning money markets
 * and credit take the most, chains and bridges the least, because a bridge's TVL is transient and
 * belongs to the chains it connects. First match wins; a null category takes the default. This is a
 * table of sectors, never a list of protocols.
 */
export const CATEGORY_MULTIPLIERS: ReadonlyArray<readonly [readonly string[], number, string]> = [
  [['lend', 'cdp', 'collateral'], 1.15, 'money markets and CDPs accrue fees directly'],
  [['rwa', 'credit'], 1.15, 'tokenised credit earns a real, visible spread'],
  [['derivativ', 'perpetual', 'basis', 'synthetic', 'option'], 1.1, 'derivatives desks churn fees'],
  [['dex', 'swap', 'otc'], 1.05, 'trading fees reach the protocol, but competitors are many'],
  [['stable'], 1.05, 'seigniorage and float are worth something to a token'],
  [['payment', 'card'], 1.05, 'payment float and card fees are durable'],
  [['insurance'], 1.05, 'underwriting capital earns a real premium'],
  [['predict'], 1.0, 'prediction markets are thin, and so is their fee take'],
  [['yield', 'allocator', 'curator', 'farm', 'liquidity', 'index'], 1.0, 'the strategy layer takes a cut of the yield'],
  [['chain'], 0.95, 'a chain\u2019s TVL is its ecosystem\u2019s, not its own'],
  [['bridge'], 0.9, 'bridged TVL is transient and usually chain-owned'],
  [['liquid staking', 'staking', 'restak', 'btc'], 0.85, 'staking yield is shared with validators and depositors'],
];

/** One confidence component: what it measures, how many points it contributes, and why. */
export interface ConfidencePart {
  key: string;
  label: string;
  points: number;
  max: number;
  note: string;
}

/** The model's arithmetic for one protocol, every intermediate the detail view shows. */
export interface ModelRun {
  implied: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
  category_reason: string;
  breadth_multiplier: number;
  age: number | null;
}

/** One row of board.json: a ranked pre-token protocol with the model's arithmetic and its farm plan. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  confidence: number;
  farm_steps: string[];
  model: {
    version: string;
    size_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    category_multiplier: number;
    category_reason: string;
    breadth_multiplier: number;
    age_days: number | null;
  };
}

/** The dashboard's compact view of one row: the board's number plus what the page needs to redraw it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  confidence: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
  breadth_multiplier: number;
  token_status: 'pre-token';
}

/** A live-token protocol: its token trades, so the market's own market cap is the number, not a model. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  symbol: string | null;
  token_status: 'live';
}

/** Everything the dashboard needs: the ranked rows, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  categories: string[];
  chains: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A name carrying a product word, in any case, as a whole word. */
const PRODUCT_WORD = /\b(wrapped|staked|staking)\b/i;
/** A name beginning with an exchange's own name is that exchange's product. */
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)/i;
/** Categories that name a product of a token that already trades, so the TVL they show is that token's. */
const PRODUCT_CATEGORIES = ['cex', 'bridge', 'liquid staking', 'liquid restaking', 'restak', 'stablecoin wrapper'];

/** Whether a protocol's record carries no token: the house's own test, both ids null. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/**
 * Whether the board may rank a protocol: its record carries no token, and it is not a product of one
 * that trades. Every test is structural — a category, a name pattern — and none names a protocol.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  const category = (p.category ?? '').toLowerCase();
  if (PRODUCT_CATEGORIES.some((key) => category.includes(key))) return false;
  if (PRODUCT_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name)) return false;
  if (VERSIONED.test(p.name)) return false;
  return true;
}

/** The category's value-capture multiple and the sentence that explains it. */
export function categoryMultiple(category: string | null, model: ModelConstants): { multiple: number; why: string } {
  const c = (category ?? '').toLowerCase();
  for (const [keys, multiple, why] of CATEGORY_MULTIPLIERS) {
    for (const key of keys) if (c.includes(key)) return { multiple, why };
  }
  return { multiple: model.category_default, why: category === null ? 'no category on record, so the model leaves it at neutral' : 'no listed family matches, so the model leaves it at neutral' };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The model's whole arithmetic for one protocol: every multiplier the detail view prints. */
export function impliedValue(p: SnapshotProtocol, asOf: string, model: ModelConstants): ModelRun {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0)));
  const growthMult = 1 + model.growth_weight * Math.log1p(growthPct / 100);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const cat = categoryMultiple(p.category, model);
  const n = p.chains.length;
  const breadthMult = n <= 1 ? 1 : 1 + model.breadth_weight * Math.min(Math.log(n) / Math.log(model.breadth_chains), 1);
  const implied = Math.max(1, Math.round(p.tvl_usd * model.size_multiple * growthMult * maturityMult * cat.multiple * breadthMult));
  return {
    implied,
    growth_pct: round4(growthPct),
    growth_multiplier: round4(growthMult),
    maturity_multiplier: round4(maturityMult),
    category_multiplier: cat.multiple,
    category_reason: cat.why,
    breadth_multiplier: round4(breadthMult),
    age,
  };
}

/** How much of the record backs the estimate, 0 to 100, with every component named for the reader. */
export function confidence(p: SnapshotProtocol, age: number | null, floorUsd: number): { score: number; parts: ConfidencePart[] } {
  const n = p.chains.length;
  const parts: ConfidencePart[] = [
    { key: 'age', label: 'Listing date on record', points: age === null ? 0 : 25, max: 25, note: age === null ? 'no listed_at: the model assumes 365 days' : `tracked for ${age} days` },
    { key: 'growth', label: 'Seven-day change reported', points: p.change_7d === null ? 0 : 25, max: 25, note: p.change_7d === null ? 'unreported: counted as flat, and not trusted' : `${p.change_7d}% over seven days` },
    { key: 'category', label: 'Category named by DefiLlama', points: p.category === null ? 0 : 15, max: 15, note: p.category ?? 'no category on record' },
    { key: 'chains', label: 'Chain coverage', points: n >= 3 ? 15 : n === 2 ? 10 : 5, max: 15, note: `${n} chain${n === 1 ? '' : 's'} count the protocol's TVL` },
    { key: 'momentum', label: 'Positive seven-day growth', points: (p.change_7d ?? 0) > 0 ? 15 : 0, max: 15, note: (p.change_7d ?? 0) > 0 ? 'TVL grew over the week' : 'flat or shrinking, so no momentum credit' },
    { key: 'size', label: 'TVL at or above the house floor', points: p.tvl_usd >= floorUsd ? 5 : 0, max: 5, note: p.tvl_usd >= floorUsd ? 'above the floor the watchlist starts at' : 'below the floor: the early radar exists for these' },
  ];
  return { score: parts.reduce((sum, part) => sum + part.points, 0), parts };
}

/**
 * The board: every protocol the snapshot carries that records no token, ranked by implied value.
 * The watchlist is the floor, so a watchlist slug is kept even if a rule above would drop it; the rest
 * of the snapshot's pre-token protocols are the early rows the radar exists to find.
 */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const watched = new Set(snapshot.watchlist);
  const chosen = snapshot.protocols.filter((p) => isRankable(p) || (watched.has(p.slug) && isPreToken(p)));
  const scored = chosen.map((p) => {
    const run = impliedValue(p, snapshot.as_of, model);
    const conf = confidence(p, run.age, snapshot.floor_usd);
    return { p, run, conf };
  });
  scored.sort((a, b) => b.run.implied - a.run.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.run.age,
    implied_value_usd: s.run.implied,
    confidence: s.conf.score,
    farm_steps: farmSteps(s.p, s.run.age).map(stepText),
    model: {
      version: MODEL_VERSION,
      size_multiple: model.size_multiple,
      growth_pct: s.run.growth_pct,
      growth_multiplier: s.run.growth_multiplier,
      maturity_multiplier: s.run.maturity_multiplier,
      category_multiplier: s.run.category_multiplier,
      category_reason: s.run.category_reason,
      breadth_multiplier: s.run.breadth_multiplier,
      age_days: s.run.age,
    },
  }));
}

/** A step as one string: its action, then its cost and its time, inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  while (s.length < 20) s = `${s} Hold the position and watch the protocol's own page.`;
  return s;
}

/** The live-token protocols, by market cap: their token trades, so their value is the market's own. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && !(p.category ?? '').toLowerCase().includes('cex'))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      symbol: p.symbol,
      token_status: 'live' as const,
    }));
}

/** A board row's compact form for data.js: the page redraws the model from these fields. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    confidence: row.confidence,
    growth_pct: row.model.growth_pct,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_multiplier: row.model.category_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    token_status: 'pre-token',
  };
}

/** Everything the dashboard renders, from the snapshot: the ranked board and the live set beside it. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watched = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watched.has(r.slug)).length,
    live_size: live.length,
    categories: [...new Set(board.map((r) => r.category).filter((c): c is string => c !== null))].sort(),
    chains: [...new Set(board.flatMap((r) => r.chains))].sort(),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** The gate's own cap on an implied value: $100 trillion. */
const IMPLIED_CAP = 100_000_000_000_000;

/**
 * Why a board is not one the gate will take, or null: the shape of every row, the ranks, the order, one
 * shared implied value, the watchlist coverage, the farm steps and the plan variety. main.ts writes no
 * board this returns an issue for.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows`;
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const row of board) {
    if (!known.has(row.slug)) return `row ${row.rank} names ${row.slug}, which the snapshot does not list`;
    if (seen.has(row.slug)) return `${row.slug} appears twice`;
    seen.add(row.slug);
    if (row.name.trim() === '') return `${row.slug} has no name`;
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0) return `${row.slug} has implied value ${row.implied_value_usd}`;
    if (row.implied_value_usd > IMPLIED_CAP) return `${row.slug} has an implied value over the cap`;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `${row.slug} has ${row.farm_steps.length} farm steps`;
    for (const step of row.farm_steps) {
      const trimmed = step.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `${row.slug} has a farm step of ${trimmed.length} characters`;
    }
  }
  const missing = snapshot.watchlist.filter((s) => !seen.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `rank ${i + 1} outranks rank ${i} on implied value`;
  }
  if (new Set(board.map((r) => r.implied_value_usd)).size === 1) return `all ${board.length} rows share one implied value: a board that ranks nothing by value is not a ranking`;
  // The plan variety the rules ask for: no step's text is reused by another protocol.
  const steps = new Map<string, string>();
  for (const row of board) {
    for (const step of row.farm_steps) {
      const trimmed = step.trim();
      const owner = steps.get(trimmed);
      if (owner !== undefined && owner !== row.slug) return `${row.slug} and ${owner} share a farm step`;
      steps.set(trimmed, row.slug);
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}



