// Token Radar's farm plans, in the page: one plan per protocol, generated from that protocol's own
// record — category, chains, TVL, seven-day change and age — by the same generator that wrote the plans
// in board.json. No slug or name is matched anywhere here, and every step carries the protocol's own
// name, chain and figures, so two protocols never share a plan.
(function (global) {
  'use strict';

  /** Capital for one position, from the protocol's TVL. */
  function capitalFor(tvlUsd) {
    if (tvlUsd >= 5e9) return 500;
    if (tvlUsd >= 1e9) return 300;
    if (tvlUsd >= 1e8) return 150;
    if (tvlUsd >= 5e7) return 100;
    return 50;
  }

  /** How long to hold, from the protocol's age. */
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  /** A rough gas cost in dollars by chain. */
  function gasForChain(chain) {
    var c = (chain || '').toLowerCase();
    if (c.indexOf('ethereum') === 0) return 6;
    if (c.indexOf('bitcoin') === 0) return 2.5;
    if (c.indexOf('base') === 0 || c.indexOf('arbitrum') === 0 || c.indexOf('optimism') === 0 || c.indexOf('linea') === 0 || c.indexOf('scroll') === 0) return 0.4;
    if (c.indexOf('polygon') === 0 || c.indexOf('zksync') === 0 || c.indexOf('mantle') === 0 || c.indexOf('berachain') === 0 || c.indexOf('unichain') === 0 || c.indexOf('blast') === 0) return 0.2;
    if (c.indexOf('binance') === 0 || c.indexOf('bnb') === 0 || c.indexOf('avalanche') === 0 || c.indexOf('sonic') === 0 || c.indexOf('flare') === 0) return 0.15;
    if (c.indexOf('solana') === 0 || c.indexOf('sui') === 0 || c.indexOf('hyperliquid') === 0 || c.indexOf('monad') === 0 || c.indexOf('plasma') === 0 || c.indexOf('stellar') === 0 || c.indexOf('aptos') === 0) return 0.05;
    return 1.5;
  }

  function chainOf(row) {
    var chains = row.chains || [];
    return chains.length > 0 && chains[0] ? chains[0] : 'its main chain';
  }

  function chainList(row) {
    var chains = row.chains || [];
    if (chains.length === 0) return 'its main chain';
    var head = chains.slice(0, 3).join(', ');
    return chains.length > 3 ? head + ' and ' + (chains.length - 3) + ' more' : head;
  }

  function shortUsd(usd) {
    if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(2) + 'B';
    if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
    if (usd >= 1e3) return '$' + Math.round(usd / 1e3) + 'K';
    return '$' + usd;
  }

  function growthPhrase(row) {
    var g = row.change_7d;
    if (g === null || g === undefined) return 'its seven-day change unreported';
    return (g >= 0 ? '+' : '') + Number(g).toFixed(2) + '% over seven days';
  }

  function agePhrase(row, age) {
    if (age === null || age === undefined) return 'no listing date on record';
    if (age >= 365) return 'listed ' + (age / 365).toFixed(1) + ' years ago';
    return 'listed ' + age + ' days ago';
  }

  /** The plan shape a category gets, matched on its name. */
  function familyOf(category) {
    var c = (category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'lend';
    if (c.indexOf('privacy') >= 0) return 'privacy';
    if (c.indexOf('bridge') >= 0) return 'bridge';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0 || c.indexOf('btc') >= 0) return 'stake';
    if (c.indexOf('locker') >= 0) return 'lock';
    if (c.indexOf('launchpad') >= 0) return 'launch';
    if (c.indexOf('governance') >= 0) return 'gov';
    if (c.indexOf('predict') >= 0) return 'predict';
    if (c.indexOf('insurance') >= 0) return 'insurance';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'pay';
    if (c.indexOf('rwa') >= 0 || c.indexOf('credit') >= 0) return 'rwa';
    if (c.indexOf('stable') >= 0) return 'stable';
    if (c.indexOf('derivativ') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('basis') >= 0 || c.indexOf('synthetic') >= 0 || c.indexOf('option') >= 0) return 'perp';
    if (c.indexOf('dex') >= 0 || c.indexOf('swap') >= 0 || c.indexOf('otc') >= 0) return 'dex';
    if (c.indexOf('index') >= 0) return 'index';
    if (c.indexOf('yield') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('liquidity') >= 0) return 'vault';
    if (c.indexOf('chain') >= 0) return 'chain';
    return 'default';
  }

  /** The family's opening move. */
  function primaryFor(family, name, chain, capital) {
    switch (family) {
      case 'lend': return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' as collateral, then borrow about half of it back in the same asset.';
      case 'dex': return 'Pair $' + capital + ' of USDC with ' + chain + "'s native asset in " + name + "'s deepest pool on " + chain + ' and set a range around the current price.';
      case 'stake': return 'Stake the equivalent of $' + capital + ' of ' + chain + "'s own asset through " + name + ' and keep the receipt token it mints.';
      case 'vault': return "Deposit $" + capital + ' of USDC into ' + name + "'s largest vault on " + chain + ' and note the strategy the vault says it runs.';
      case 'bridge': return 'Bridge $' + capital + ' of USDC from ' + chain + ' to the other side through ' + name + ' and confirm the amount that arrives.';
      case 'perp': return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' (' + chain + ') and open one small position at 2x at most.';
      case 'rwa': return 'Buy $' + capital + ' of the tokenised asset ' + name + ' offers on ' + chain + ' and hold it in the same wallet you farm with.';
      case 'stable': return 'Mint or deposit $' + capital + " of " + name + "'s stable asset on " + chain + ' and keep the position open.';
      case 'insurance': return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' for an asset you hold, and keep the policy active.';
      case 'predict': return 'Fund $' + capital + ' into ' + name + ' on ' + chain + ' and place two small positions in different markets.';
      case 'pay': return 'Top up $' + capital + ' into ' + name + ' on ' + chain + ' and make real payments with it, not only a deposit.';
      case 'chain': return 'Bridge $' + capital + ' onto ' + chain + ", then swap and deposit inside " + name + "'s own app instead of leaving it idle.";
      case 'privacy': return "Deposit $" + capital + " into " + name + "'s pool on " + chain + ' and keep the note it returns backed up offline.';
      case 'lock': return 'Lock $' + capital + ' of LP or governance tokens for the shortest period ' + name + ' offers on ' + chain + '.';
      case 'gov': return 'Hold $' + capital + " of " + name + "'s voting asset on " + chain + ' and delegate it to an active delegate.';
      case 'index': return 'Mint $' + capital + ' of the basket ' + name + ' tracks on ' + chain + ' and keep the index token itself.';
      case 'launch': return 'Fund $' + capital + ' on ' + chain + ' and take part in the next sale or points round ' + name + ' announces.';
      default: return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
    }
  }

  /** The family's second move. */
  function secondaryFor(family, name, chain) {
    switch (family) {
      case 'lend': return "Watch " + name + "'s health factor weekly and add collateral if it drops under 1.6, or the borrowed side gets liquidated.";
      case 'dex': return "Rebalance " + name + "'s range whenever price leaves it by 10 per cent, and collect the pool's fees in the same transaction.";
      case 'stake': return 'Check the validator or operator set behind ' + name + " monthly and move your stake if one operator's share grows too large.";
      case 'vault': return "Review " + name + "'s allocation page monthly and move the position to its new top vault when the strategy it lists changes.";
      case 'bridge': return 'Use the funds ' + name + ' bridged inside ' + chain + "'s main app before any trip back, so the round trip carries real activity.";
      case 'perp': return "Keep " + name + "'s position above 25 per cent margin, and close it at the next funding reset rather than holding it forever.";
      case 'rwa': return 'Check the net asset value of what ' + name + " issued weekly on its own dashboard and rotate out if the stated yield falls away.";
      case 'stable': return 'Provide the asset ' + name + ' minted into its own pool, or stake it wherever ' + name + ' publishes an incentive.';
      case 'insurance': return 'Add a second policy on another asset, so ' + name + "'s record carries more than one underwriting line.";
      case 'predict': return 'Close one position on ' + name + ' and open another each month, so the record shows settled trades and not only opened ones.';
      case 'pay': return "Move the balance through " + name + "'s card or payment rails monthly and keep the receipts it sends you.";
      case 'chain': return 'Do one swap and one deposit on ' + name + ' every week of the window, so the activity on ' + chain + ' cannot read as a one-off.';
      case 'privacy': return 'Make a second deposit of a different size into ' + name + ' the next month, so the two notes are not a matched pair.';
      case 'lock': return "Add to " + name + "'s lock monthly: it weights the longest locks of the same size the heaviest.";
      case 'gov': return 'Vote on every proposal ' + name + ' posts while you hold; the votes are public and countable.';
      case 'index': return 'Rebalance through ' + name + ' once a quarter, so the record shows an index held, not a token bought once.';
      case 'launch': return 'Keep the funds in the wallet ' + name + ' tracks and in the asset it counts; a round is usually weighted by the balance at its snapshot.';
      default: return 'Make one further deposit a month into ' + name + ', so the account reads as a user rather than a single transaction.';
    }
  }

  /** The family's weekly action, as one short phrase. */
  function weeklyFor(family, name, chain) {
    switch (family) {
      case 'lend': return 'a deposit or a repay on ' + name;
      case 'dex': return 'a swap through ' + name;
      case 'stake': return 'a claim of staking rewards from ' + name;
      case 'vault': return 'a harvest or a re-deposit into ' + name;
      case 'bridge': return 'a small transfer through ' + name;
      case 'perp': return 'one small trade on ' + name;
      case 'rwa': return 'a buy or a redemption on ' + name;
      case 'stable': return 'a mint or a repay through ' + name;
      case 'insurance': return 'one policy action on ' + name;
      case 'predict': return 'one small market position on ' + name;
      case 'pay': return 'one payment through ' + name;
      case 'chain': return 'one swap or deposit on ' + name + ' in ' + chain;
      case 'privacy': return 'one deposit or withdrawal in ' + name;
      case 'lock': return 'a lock or an extension on ' + name;
      case 'gov': return 'a vote or a delegation change on ' + name;
      case 'index': return 'a buy of ' + name + "'s basket";
      case 'launch': return 'a deposit into ' + name + "'s round";
      default: return 'one deposit or withdrawal on ' + name;
    }
  }

  /** One protocol's eight-step plan, each step an action with a cost and a time. */
  function farmSteps(row) {
    var name = row.name;
    var chain = chainOf(row);
    var family = familyOf(row.category);
    var capital = capitalFor(row.tvl_usd);
    var hold = holdDaysFor(row.age_days);
    var weeks = Math.max(2, Math.ceil(hold / 7));
    var gas = gasForChain(chain);
    var size = shortUsd(row.tvl_usd);
    var growth = growthPhrase(row);
    var weekly = weeklyFor(family, name, chain);
    return [
      { text: 'Open ' + name + ' on ' + chainList(row) + ' with a fresh wallet holding $' + capital + " for the position and a little more for gas; copy the app's address from " + name + "'s own docs and check it in a block explorer before you sign anything.", cost: 'about $' + gas + ' of gas on ' + chain + ' for the first transaction', time: '15 minutes' },
      { text: primaryFor(family, name, chain, capital), cost: '$' + capital + ' of capital plus roughly $' + gas + ' of gas', time: '20 minutes to set up' },
      { text: secondaryFor(family, name, chain), cost: 'nothing beyond the position; each check costs about $' + gas + ' of gas', time: '10 minutes a month' },
      { text: 'For ' + weeks + ' weeks, log in to ' + name + ' and make ' + weekly + ': the amount can be small, but the record has to show the week.', cost: 'about $' + (gas * weeks).toFixed(0) + ' of gas across the whole window', time: weeks + ' weeks' },
      { text: 'Keep the wallet at or above $' + capital + ' while ' + name + ' holds ' + size + ' of TVL with ' + growth + ', and it stands ' + agePhrase(row, row.age_days) + '; a snapshot each week for ' + weeks + ' weeks then sees a real position, not an empty wallet.', cost: 'free to hold; the capital stays in the position', time: weeks + ' weeks' },
      { text: "Plan " + name + "'s exit: the $" + capital + ' is working or locked for at least ' + hold + ' days, and withdrawing after the last snapshot costs about $' + gas + ' of gas on ' + chain + '.', cost: 'about $' + gas + ' of gas to withdraw', time: '1 day after the ' + weeks + '-week window' },
      { text: 'When ' + name + " publishes a points or claim page, open it from the domain in its own docs, connect only this wallet, and never pay a fee to claim: a real claim costs gas and nothing else.", cost: 'gas only, and never a fee', time: '20 minutes' },
      { text: 'Write ' + name + ' (' + chain + '), the ' + size + ' of TVL it carried at ' + growth + ', every weekly transaction and the exit date in a farm log, so the same plan can be repeated on the next protocol.', cost: 'nothing', time: '15 minutes' },
    ].map(stepText);
  }

  /** A step as one string: its action, then its cost and its time, inside the gate's 20..600 characters. */
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    while (s.length < 20) s = s + " Hold the position and watch the protocol's own page.";
    return s;
  }

  global.RadarPlan = {
    capitalFor: capitalFor,
    holdDaysFor: holdDaysFor,
    gasForChain: gasForChain,
    chainOf: chainOf,
    chainList: chainList,
    shortUsd: shortUsd,
    growthPhrase: growthPhrase,
    agePhrase: agePhrase,
    familyOf: familyOf,
    farmSteps: farmSteps,
    stepText: stepText,
  };
})(window);
