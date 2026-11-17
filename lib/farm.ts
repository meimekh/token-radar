// Farm plans: a concrete plan for one protocol, derived from that protocol's own record.
//
// Every step names the protocol, its chain and its own figures, and carries what it costs (rough
// dollars, or free) and how long it takes (minutes, days or weeks). The shape of the plan follows the
// protocol's category: a lender's plan supplies collateral and borrows, a DEX's plan provides
// liquidity and rebalances its range, a bridge's plan moves funds across and uses them on arrival.
// Nothing here matches on a protocol's slug or name: the same generator writes every row, so a row's
// plan is a function of its category, chains, TVL, seven-day change and age.

import type { FarmStep, SnapshotProtocol } from './model.ts';

/** How much capital one farm position needs, from the protocol's own TVL. Rough, and stated as such. */
export function capitalFor(tvlUsd: number): number {
  if (tvlUsd >= 5_000_000_000) return 500;
  if (tvlUsd >= 1_000_000_000) return 300;
  if (tvlUsd >= 100_000_000) return 150;
  if (tvlUsd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: a younger protocol needs a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** A rough one-transaction gas cost in dollars for a chain, from its fee level. Estimation, not a quote. */
export function gasForChain(chain: string): number {
  const c = chain.toLowerCase();
  if (c.startsWith('ethereum')) return 6;
  if (c.startsWith('bitcoin')) return 2.5;
  if (c.startsWith('base') || c.startsWith('arbitrum') || c.startsWith('optimism') || c.startsWith('linea') || c.startsWith('scroll')) return 0.4;
  if (c.startsWith('polygon') || c.startsWith('zksync') || c.startsWith('mantle') || c.startsWith('berachain') || c.startsWith('unichain') || c.startsWith('blast')) return 0.2;
  if (c.startsWith('binance') || c.startsWith('bnb') || c.startsWith('avalanche') || c.startsWith('sonic') || c.startsWith('flare')) return 0.15;
  if (c.startsWith('solana') || c.startsWith('sui') || c.startsWith('hyperliquid') || c.startsWith('monad') || c.startsWith('plasma') || c.startsWith('stellar') || c.startsWith('aptos')) return 0.05;
  return 1.5;
}

/** The first chain a protocol names, or a neutral phrase. */
export function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 && p.chains[0] !== undefined && p.chains[0] !== '' ? p.chains[0] : 'its main chain';
}

/** The protocol's chains, at most three, as one phrase. */
function chainList(p: SnapshotProtocol): string {
  if (p.chains.length === 0) return 'its main chain';
  const head = p.chains.slice(0, 3).join(', ');
  return p.chains.length > 3 ? `${head} and ${p.chains.length - 3} more` : head;
}

/** A whole-dollar figure as a short string: $812.4M, $2.35B, $5.0M. */
export function shortUsd(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${usd}`;
}

/** The protocol's seven-day change as a phrase a reader can check against the board. */
export function growthPhrase(p: SnapshotProtocol): string {
  if (p.change_7d === null) return 'its seven-day change unreported';
  const sign = p.change_7d >= 0 ? '+' : '';
  return `${sign}${p.change_7d.toFixed(2)}% over seven days`;
}

/** The protocol's age as a phrase. */
export function agePhrase(p: SnapshotProtocol, age: number | null): string {
  if (age === null) return 'no listing date on record';
  if (age >= 365) return `listed ${(age / 365).toFixed(1)} years ago`;
  return `listed ${age} days ago`;
}

/** Which plan shape a category gets: one family per kind of protocol, matched on the category name. */
export function familyOf(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lend';
  if (c.includes('privacy')) return 'privacy';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('liquid staking') || c.includes('staking') || c.includes('restak') || c.includes('btc')) return 'stake';
  if (c.includes('locker')) return 'lock';
  if (c.includes('launchpad')) return 'launch';
  if (c.includes('governance')) return 'gov';
  if (c.includes('predict')) return 'predict';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('payment') || c.includes('card')) return 'pay';
  if (c.includes('rwa') || c.includes('credit')) return 'rwa';
  if (c.includes('stable')) return 'stable';
  if (c.includes('derivativ') || c.includes('perpetual') || c.includes('basis') || c.includes('synthetic') || c.includes('option')) return 'perp';
  if (c.includes('dex') || c.includes('swap') || c.includes('otc')) return 'dex';
  if (c.includes('index')) return 'index';
  if (c.includes('yield') || c.includes('allocator') || c.includes('curator') || c.includes('farm') || c.includes('liquidity')) return 'vault';
  if (c.includes('chain')) return 'chain';
  return 'default';
}

/** The family's opening move: what a farmer actually does with the capital on this kind of protocol. */
function primaryFor(family: string, name: string, chain: string, capital: number): string {
  switch (family) {
    case 'lend': return `Supply $${capital} of USDC to ${name} on ${chain} as collateral, then borrow about half of it back in the same asset.`;
    case 'dex': return `Pair $${capital} of USDC with ${chain}'s native asset in ${name}'s deepest pool on ${chain} and set a range around the current price.`;
    case 'stake': return `Stake the equivalent of $${capital} of ${chain}'s own asset through ${name} and keep the receipt token it mints.`;
    case 'vault': return `Deposit $${capital} of USDC into ${name}'s largest vault on ${chain} and note the strategy the vault says it runs.`;
    case 'bridge': return `Bridge $${capital} of USDC from ${chain} to the other side through ${name} and confirm the amount that arrives.`;
    case 'perp': return `Deposit $${capital} of USDC as margin on ${name} (${chain}) and open one small position at 2x at most.`;
    case 'rwa': return `Buy $${capital} of the tokenised asset ${name} offers on ${chain} and hold it in the same wallet you farm with.`;
    case 'stable': return `Mint or deposit $${capital} of ${name}'s stable asset on ${chain} and keep the position open.`;
    case 'insurance': return `Buy $${capital} of cover from ${name} on ${chain} for an asset you hold, and keep the policy active.`;
    case 'predict': return `Fund $${capital} into ${name} on ${chain} and place two small positions in different markets.`;
    case 'pay': return `Top up $${capital} into ${name} on ${chain} and make real payments with it, not only a deposit.`;
    case 'chain': return `Bridge $${capital} onto ${chain}, then swap and deposit inside ${name}'s own app instead of leaving it idle.`;
    case 'privacy': return `Deposit $${capital} into ${name}'s pool on ${chain} and keep the note it returns backed up offline.`;
    case 'lock': return `Lock $${capital} of LP or governance tokens for the shortest period ${name} offers on ${chain}.`;
    case 'gov': return `Hold $${capital} of ${name}'s voting asset on ${chain} and delegate it to an active delegate.`;
    case 'index': return `Mint $${capital} of the basket ${name} tracks on ${chain} and keep the index token itself.`;
    case 'launch': return `Fund $${capital} on ${chain} and take part in the next sale or points round ${name} announces.`;
    default: return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
}

/** The family's second move: the follow-up that makes the record look like a user's. */
function secondaryFor(family: string, name: string, chain: string): string {
  switch (family) {
    case 'lend': return `Watch ${name}'s health factor weekly and add collateral if it drops under 1.6, or the borrowed side gets liquidated.`;
    case 'dex': return `Rebalance ${name}'s range whenever price leaves it by 10 per cent, and collect the pool's fees in the same transaction.`;
    case 'stake': return `Check the validator or operator set behind ${name} monthly and move your stake if one operator's share grows too large.`;
    case 'vault': return `Review ${name}'s allocation page monthly and move the position to its new top vault when the strategy it lists changes.`;
    case 'bridge': return `Use the funds ${name} bridged inside ${chain}'s main app before any trip back, so the round trip carries real activity.`;
    case 'perp': return `Keep ${name}'s position above 25 per cent margin, and close it at the next funding reset rather than holding it forever.`;
    case 'rwa': return `Check the net asset value of what ${name} issued weekly on its own dashboard and rotate out if the stated yield falls away.`;
    case 'stable': return `Provide the asset ${name} minted into its own pool, or stake it wherever ${name} publishes an incentive.`;
    case 'insurance': return `Add a second policy on another asset, so ${name}'s record carries more than one underwriting line.`;
    case 'predict': return `Close one position on ${name} and open another each month, so the record shows settled trades and not only opened ones.`;
    case 'pay': return `Move the balance through ${name}'s card or payment rails monthly and keep the receipts it sends you.`;
    case 'chain': return `Do one swap and one deposit on ${name} every week of the window, so the activity on ${chain} cannot read as a one-off.`;
    case 'privacy': return `Make a second deposit of a different size into ${name} the next month, so the two notes are not a matched pair.`;
    case 'lock': return `Add to ${name}'s lock monthly: it weights the longest locks of the same size the heaviest.`;
    case 'gov': return `Vote on every proposal ${name} posts while you hold; the votes are public and countable.`;
    case 'index': return `Rebalance through ${name} once a quarter, so the record shows an index held, not a token bought once.`;
    case 'launch': return `Keep the funds in the wallet ${name} tracks and in the asset it counts; a round is usually weighted by the balance at its snapshot.`;
    default: return `Make one further deposit a month into ${name}, so the account reads as a user rather than a single transaction.`;
  }
}

/** The family's weekly action, as one short phrase. */
function weeklyFor(family: string, name: string, chain: string): string {
  switch (family) {
    case 'lend': return `a deposit or a repay on ${name}`;
    case 'dex': return `a swap through ${name}`;
    case 'stake': return `a claim of staking rewards from ${name}`;
    case 'vault': return `a harvest or a re-deposit into ${name}`;
    case 'bridge': return `a small transfer through ${name}`;
    case 'perp': return `one small trade on ${name}`;
    case 'rwa': return `a buy or a redemption on ${name}`;
    case 'stable': return `a mint or a repay through ${name}`;
    case 'insurance': return `one policy action on ${name}`;
    case 'predict': return `one small market position on ${name}`;
    case 'pay': return `one payment through ${name}`;
    case 'chain': return `one swap or deposit on ${name} in ${chain}`;
    case 'privacy': return `one deposit or withdrawal in ${name}`;
    case 'lock': return `a lock or an extension on ${name}`;
    case 'gov': return `a vote or a delegation change on ${name}`;
    case 'index': return `a buy of ${name}'s basket`;
    case 'launch': return `a deposit into ${name}'s round`;
    default: return `one deposit or withdrawal on ${name}`;
  }
}

/**
 * A protocol's farm plan: eight steps, each an action with what it costs and how long it takes. Every
 * step carries the protocol's own name, chain and figures, so two protocols never share a plan.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const name = p.name;
  const chain = chainOf(p);
  const family = familyOf(p.category);
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const weeks = Math.max(2, Math.ceil(hold / 7));
  const gas = gasForChain(chain);
  const size = shortUsd(p.tvl_usd);
  const growth = growthPhrase(p);
  const weekly = weeklyFor(family, name, chain);
  return [
    {
      text: `Open ${name} on ${chainList(p)} with a fresh wallet holding $${capital} for the position and a little more for gas; copy the app's address from ${name}'s own docs and check it in a block explorer before you sign anything.`,
      cost: `about $${gas} of gas on ${chain} for the first transaction`,
      time: '15 minutes',
    },
    {
      text: primaryFor(family, name, chain, capital),
      cost: `$${capital} of capital plus roughly $${gas} of gas`,
      time: '20 minutes to set up',
    },
    {
      text: secondaryFor(family, name, chain),
      cost: `nothing beyond the position; each check costs about $${gas} of gas`,
      time: '10 minutes a month',
    },
    {
      text: `For ${weeks} weeks, log in to ${name} and make ${weekly}: the amount can be small, but the record has to show the week.`,
      cost: `about $${(gas * weeks).toFixed(0)} of gas across the whole window`,
      time: `${weeks} weeks`,
    },
    {
      text: `Keep the wallet at or above $${capital} while ${name} holds ${size} of TVL with ${growth}, and it stands ${agePhrase(p, age)}; a snapshot each week for ${weeks} weeks then sees a real position, not an empty wallet.`,
      cost: 'free to hold; the capital stays in the position',
      time: `${weeks} weeks`,
    },
    {
      text: `Plan ${name}'s exit: the $${capital} is working or locked for at least ${hold} days, and withdrawing after the last snapshot costs about $${gas} of gas on ${chain}.`,
      cost: `about $${gas} of gas to withdraw`,
      time: `1 day after the ${weeks}-week window`,
    },
    {
      text: `When ${name} publishes a points or claim page, open it from the domain in its own docs, connect only this wallet, and never pay a fee to claim: a real claim costs gas and nothing else.`,
      cost: 'gas only, and never a fee',
      time: '20 minutes',
    },
    {
      text: `Write ${name} (${chain}), the ${size} of TVL it carried at ${growth}, every weekly transaction and the exit date in a farm log, so the same plan can be repeated on the next protocol.`,
      cost: 'nothing',
      time: '15 minutes',
    },
  ];
}
