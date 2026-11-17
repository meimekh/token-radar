// Token Radar's page: a ranked board of every protocol the snapshot records with no token, a detail
// view per protocol, and filters over category, chain and token status. No framework, no build step,
// no network: every byte on the page comes from ../data.js, which main.ts writes beside the page.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var Model = window.RadarModel;
  var Plan = window.RadarPlan;
  var app = document.getElementById('app');
  var dialog = document.getElementById('detail');
  var MODEL = Model.MODEL;
  var FLOOR = DATA ? DATA.floor_usd : 50000000;

  // The view's state. Rank follows the board's implied value; the sort and filters only change the view.
  var state = { q: '', category: 'all', chain: 'all', status: 'pre', sort: 'implied', dir: -1, selected: null };

  var number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + number.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + Number(n).toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else if (key === 'html') node.innerHTML = attrs[key];
        else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), attrs[key]);
        else if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, attrs[key]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // Two kinds of row, kept apart on purpose: a ranked row records no token, so its value is the model's
  // claim; a live row's token trades, so its value is the market's own market cap, a fact.
  var RANKED = DATA ? DATA.rows.map(function (r) {
    var copy = {};
    Object.keys(r).forEach(function (k) { copy[k] = r[k]; });
    copy.kind = 'pre';
    copy.value = r.implied_value_usd;
    return copy;
  }) : [];
  var LIVE = DATA ? DATA.live.filter(function (r) { return r.mcap_usd !== null; }).map(function (r) {
    return {
      rank: null, slug: r.slug, name: r.name, category: r.category, chains: r.chains, tvl_usd: r.tvl_usd,
      change_7d: r.change_7d, mcap_usd: r.mcap_usd, symbol: r.symbol, listed_at: null, age_days: null,
      implied_value_usd: null, confidence: null, kind: 'live', value: r.mcap_usd,
    };
  }) : [];

  /** The rows the current filters keep: one search, one category, one chain, one token status. */
  function filterRows(rows, s) {
    var q = (s.q || '').trim().toLowerCase();
    return rows.filter(function (r) {
      if (s.status === 'pre' && r.kind !== 'pre') return false;
      if (s.status === 'live' && r.kind !== 'live') return false;
      if (s.category !== 'all' && (r.category || 'Other') !== s.category) return false;
      if (s.chain !== 'all' && (r.chains || []).indexOf(s.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, r.symbol, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  /** One sort key for a row: implied value, TVL, growth, age, confidence, or the name. */
  function sortValue(row, key) {
    if (key === 'tvl') return row.tvl_usd;
    if (key === 'growth') return row.change_7d === null || row.change_7d === undefined ? -Infinity : row.change_7d;
    if (key === 'age') return row.age_days === null || row.age_days === undefined ? Infinity : row.age_days;
    if (key === 'confidence') return row.confidence === null || row.confidence === undefined ? -1 : row.confidence;
    if (key === 'name') return null;
    return row.value;
  }

  /** The filtered rows in the reader's order; ties fall back to the name, so the view is stable. */
  function sortRows(rows, s) {
    var dir = s.dir < 0 ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var av = sortValue(a, s.sort);
      var bv = sortValue(b, s.sort);
      if (s.sort === 'name') {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  function allRows() { return RANKED.concat(LIVE); }
  function categoriesNow() {
    var seen = {};
    RANKED.forEach(function (r) { seen[r.category || 'Other'] = true; });
    return Object.keys(seen).sort();
  }
  function chainsNow() {
    var seen = {};
    RANKED.forEach(function (r) { (r.chains || []).forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('span', { class: 'wordmark', text: 'Token Radar' }),
        el('span', { class: 'chip', text: 'make.fun · token-radar-01' })
      ),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'Model ' + Model.MODEL_VERSION }),
        el('span', { text: 'DefiLlama protocol index, ' + (RANKED.length + DATA.live.length) + ' protocols' })
      )
    );
  }

  function fact(label, value, note) {
    return el('div', { class: 'fact' },
      el('span', { class: 'fact-label', text: label }),
      el('b', { class: 'fact-value', text: value }),
      el('span', { class: 'fact-note', text: note })
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('div', { class: 'hero-copy' },
        el('p', { class: 'eyebrow', text: 'Pre-token protocol radar' }),
        el('h1', { text: DATA.board_size + ' protocols with no token on record, ranked by implied value' }),
        el('p', { class: 'lede-text', text: 'Implied value is what a protocol\u2019s token would be worth if its record stayed exactly as it is today: a claim this board makes from the snapshot\u2019s own TVL, seven-day growth, age, category and chain coverage. It is not a prediction that a token arrives, and it is not a price.' }),
        el('p', { class: 'lede-text', text: 'The house watchlist of ' + DATA.watchlist_size + ' protocols above $' + Math.round(FLOOR / 1e6) + 'M is this board\u2019s floor, never its ceiling: the other ' + DATA.early_size + ' ranked rows are pre-token protocols the floor left out \u2014 the ones the radar exists to find before the market does. A protocol leaves the ranking only on structural grounds, never by name or slug: a CEX, a bridge or a staking or wrapper product of a token that already trades, an exchange\u2019s own product, or a versioned pool whose TVL is its parent\u2019s.' })
      ),
      el('div', { class: 'facts' },
        fact('Watchlist covered', DATA.watchlist_covered + ' / ' + DATA.watchlist_size, 'every slug the snapshot names'),
        fact('Ranked rows', String(DATA.board_size), 'no token on record, not a product of one'),
        fact('Early rows', String(DATA.early_size), 'below or outside the floor'),
        fact('Set aside as live', String(DATA.live_size), 'token already trades: market cap is a fact'),
        fact('Top implied value', fmtUsd(RANKED.length ? RANKED[0].implied_value_usd : 0), RANKED.length ? RANKED[0].name : '')
      )
    );
  }

  function formulaPanel() {
    var rows = Model.CATEGORY_MULTIPLIERS.map(function (entry) {
      return el('tr', null,
        el('td', { text: entry[0].join(', ') }),
        el('td', { class: 'num', text: 'x' + entry[1].toFixed(2) }),
        el('td', { class: 'sub', text: entry[2] })
      );
    });
    return el('details', { class: 'panel model' },
      el('summary', null,
        el('h2', { text: 'How implied value is computed' }),
        el('span', { class: 'sub', text: 'the formula, its constants and every assumption behind it' })
      ),
      el('div', { class: 'model-body' },
        el('pre', { class: 'formula', text: [
          'implied = round( size x growth x maturity x category x breadth )',
          '',
          'size     = tvl_usd x ' + MODEL.size_multiple,
          'growth   = 1 + ' + MODEL.growth_weight + ' x ln(1 + clamp(change_7d, ' + MODEL.growth_floor + ', ' + MODEL.growth_cap + ') / 100)',
          'maturity = ' + MODEL.maturity_floor + ' + min(age_days, ' + MODEL.maturity_days + ') / ' + MODEL.maturity_days + ' x ' + MODEL.maturity_range,
          'category = the protocol\u2019s own category, from the table below',
          'breadth  = 1 + ' + MODEL.breadth_weight + ' x min(ln(chains) / ln(' + MODEL.breadth_chains + '), 1)',
        ].join('\n') }),
        el('ul', { class: 'assumptions' },
          el('li', { text: 'Size: a token is taken at about a fifth of the protocol\u2019s TVL, the middle of what live DeFi tokens trade at against their own TVL; TVL is the snapshot\u2019s whole-dollar figure.' }),
          el('li', { text: 'Growth is logarithmic and clamped to ' + MODEL.growth_floor + '%..' + MODEL.growth_cap + '%, so a week that doubles growth adds a fixed amount and one violent week cannot invent a price. An unreported change counts as flat and costs confidence.' }),
          el('li', { text: 'Maturity rises with the time the snapshot has tracked the protocol with no token on record and saturates at ' + MODEL.maturity_days + ' days (' + (MODEL.maturity_days / 365).toFixed(1) + ' years): a long record is evidence of a real protocol, not of a bigger claim. A missing listing date is assumed ' + MODEL.unknown_age_days + ' days.' }),
          el('li', { text: 'Category is the sector\u2019s share of value a token could capture, from the table below. It is a sector table, never a list of protocols, and the model has no per-protocol exception.' }),
          el('li', { text: 'Breadth rewards deployment across chains up to ' + MODEL.breadth_chains + ', then stops: more chains is more distribution, not unlimited value. The chain count is the snapshot\u2019s own list.' }),
          el('li', { text: 'Confidence is separate from value: it reports how much of the record exists (listing date, seven-day change, category, chains, momentum, size above the house floor) on a 0..100 scale, and never moves a rank.' }),
          el('li', { text: 'A live-token protocol is never scored: its market cap is what the market says, so it is shown with its own number and status, filterable but never ranked.' })
        ),
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { text: 'Category family' }), el('th', { text: 'Multiple' }), el('th', { text: 'Why' }))),
          el('tbody', null, rows)
        )
      )
    );
  }

  function controls() {
    var total = filterRows(allRows(), state).length;
    var search = el('input', { type: 'search', id: 'q', value: state.q, placeholder: 'Search a protocol, a chain, a ticker', 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var category = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categoriesNow().map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    category.addEventListener('change', function () { state.category = category.value; writeHash(); render(); });
    var chain = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      [el('option', { value: 'all', text: 'All chains' })].concat(chainsNow().map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); }))
    );
    chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); render(); });
    var sort = el('select', { id: 'sort', 'aria-label': 'Sort the board' },
      [['implied', 'Implied value'], ['tvl', 'TVL'], ['growth', 'Seven-day growth'], ['age', 'Age with no token'], ['confidence', 'Confidence'], ['name', 'Name']].map(function (pair) {
        return el('option', { value: pair[0], text: pair[1], selected: pair[0] === state.sort ? 'selected' : null });
      })
    );
    sort.addEventListener('change', function () { state.sort = sort.value; state.dir = state.sort === 'name' || state.sort === 'age' ? 1 : -1; writeHash(); render(); });
    var status = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Token status' },
      [['pre', 'No token'], ['live', 'Token trades'], ['all', 'Both']].map(function (pair) {
        return el('button', { type: 'button', text: pair[1], 'aria-pressed': state.status === pair[0] ? 'true' : 'false', onclick: function () { state.status = pair[0]; writeHash(); render(); } });
      })
    );
    return el('section', { class: 'controls' },
      el('label', { class: 'field wide' }, el('span', { text: 'Search' }), search),
      el('label', { class: 'field' }, el('span', { text: 'Category' }), category),
      el('label', { class: 'field' }, el('span', { text: 'Chain' }), chain),
      el('label', { class: 'field' }, el('span', { text: 'Sort by' }), sort),
      el('label', { class: 'field' }, el('span', { text: 'Token status' }), status),
      el('div', { class: 'control-foot' },
        el('span', { class: 'count', text: total + ' of ' + allRows().length + ' protocols shown' }),
        el('button', { class: 'button', type: 'button', text: 'Reset', onclick: reset })
      )
    );
  }

  function reset() {
    state.q = '';
    state.category = 'all';
    state.chain = 'all';
    state.status = 'pre';
    state.sort = 'implied';
    state.dir = -1;
    writeHash();
    render();
  }

  function sortHeader(label, key) {
    return el('th', { scope: 'col', class: 'sortable' },
      el('button', {
        type: 'button',
        'aria-label': 'Sort by ' + label,
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'name' || key === 'age' ? 1 : -1; }
          writeHash();
          render();
        },
      }, label, state.sort === key ? el('span', { class: 'arrow', 'aria-hidden': 'true', text: state.dir < 0 ? ' \u25be' : ' \u25b4' }) : null)
    );
  }

  function valueCell(row, maxValue) {
    if (row.kind === 'live') {
      return el('td', { class: 'value' },
        el('div', { class: 'value-line' },
          el('span', { class: 'num', text: fmtUsd(row.mcap_usd) }),
          el('span', { class: 'tag live', text: 'market cap' })
        )
      );
    }
    var pct = Math.max(2, Math.round((row.implied_value_usd / maxValue) * 100));
    return el('td', { class: 'value' },
      el('div', { class: 'value-line' },
        el('span', { class: 'num', text: fmtUsd(row.implied_value_usd) }),
        el('span', { class: 'tag', text: 'modelled' })
      ),
      el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + pct + '%' }))
    );
  }

  function confidenceCell(row) {
    if (row.confidence === null || row.confidence === undefined) return el('td', { class: 'num', text: '\u2014' });
    return el('td', { class: 'confidence' },
      el('div', { class: 'value-line' },
        el('span', { class: 'num', text: String(row.confidence) }),
        el('span', { class: 'sub', text: '/100' })
      ),
      el('div', { class: 'bar thin', 'aria-hidden': 'true' }, el('i', { style: 'width:' + row.confidence + '%' }))
    );
  }

  function rowNode(row, maxValue) {
    var growth = row.change_7d;
    var growthClass = growth === null || growth === undefined ? '' : growth >= 0 ? 'pos' : 'neg';
    return el('tr', {
      'data-slug': row.slug,
      'data-kind': row.kind,
      'data-selected': state.selected === row.slug ? 'true' : 'false',
      tabindex: '0',
      onclick: function () { openDetail(row); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(row); } },
    },
      el('td', { class: 'rank num', text: row.rank === null ? '\u2014' : String(row.rank) }),
      el('td', { class: 'proto' },
        el('b', { text: row.name }),
        el('span', { class: 'sub', text: (row.category || 'no category') + ' \u00b7 ' + ((row.chains || []).length ? (row.chains[0] + ((row.chains.length > 1) ? ' +' + (row.chains.length - 1) : '')) : 'no chain listed') })
      ),
      el('td', { class: 'num', text: fmtUsd(row.tvl_usd) }),
      el('td', { class: 'num ' + growthClass, text: fmtPct(growth) }),
      el('td', { class: 'num', text: fmtAge(row.age_days) }),
      confidenceCell(row),
      valueCell(row, maxValue),
      el('td', null, el('span', { class: 'tag ' + (row.kind === 'live' ? 'live' : ''), text: row.kind === 'live' ? (row.symbol ? 'trades \u00b7 ' + row.symbol : 'trades') : 'no token' }))
    );
  }

  function boardTable() {
    var list = sortRows(filterRows(allRows(), state), state);
    if (list.length === 0) {
      return el('section', { class: 'panel empty', id: 'board-panel' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search, or widen the category, chain or token-status filter, to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Reset the filters', onclick: reset })
      );
    }
    var maxValue = list.reduce(function (m, r) { return Math.max(m, r.value || 0); }, 1);
    var tbody = el('tbody');
    var dividerShown = false;
    list.forEach(function (row) {
      if (state.status === 'all' && row.kind === 'live' && !dividerShown) {
        dividerShown = true;
        tbody.appendChild(el('tr', { class: 'divider' }, el('td', { colspan: '8' },
          el('b', { text: 'Token already trades' }),
          el('span', { class: 'sub', text: ' these protocols record a token, so the number beside them is the market\u2019s own market cap, never the model\u2019s claim, and they hold no rank' })
        )));
      }
      tbody.appendChild(rowNode(row, maxValue));
    });
    var note = state.status === 'pre'
      ? 'Pre-token protocols, strongest implied value first. The rank is the model\u2019s claim; the filters and the sort only change the view.'
      : 'Ranked rows keep rank 1..' + RANKED.length + ' by implied value' + (state.status === 'live' ? '; this view shows the live-token set, which is ranked by nothing' : ', and the live-token set below the divider is ranked by nothing');
    return el('section', { class: 'panel', id: 'board-panel' },
      el('div', { class: 'table-head' },
        el('h2', { text: 'The board' }),
        el('span', { class: 'sub', text: note })
      ),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { class: 'sub', text: 'Select a row for the protocol\u2019s figures, the model\u2019s arithmetic and its farm plan. Sort by any column header.' }),
          el('thead', null, el('tr', null,
            sortHeader('Rank', 'implied'),
            sortHeader('Protocol', 'name'),
            sortHeader('TVL', 'tvl'),
            sortHeader('Seven-day growth', 'growth'),
            sortHeader('Age', 'age'),
            sortHeader('Confidence', 'confidence'),
            sortHeader('Implied value', 'implied'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function figure(label, value, note) {
    return el('div', { class: 'figure' },
      el('span', { class: 'fact-label', text: label }),
      el('b', { class: 'num', text: value }),
      note ? el('span', { class: 'sub', text: note }) : null
    );
  }

  function arithmeticList(row, run) {
    var growth = row.change_7d;
    var lines = [
      ['Start from the snapshot\u2019s TVL', fmtUsd(row.tvl_usd) + ' \u00d7 ' + MODEL.size_multiple + ' = ' + fmtUsd(run.size), 'size term'],
      ['Seven-day growth, logarithmic', (growth === null || growth === undefined ? 'unreported, so flat (0%)' : fmtPct(growth) + ', clamped to ' + run.growth_pct + '%') + ' \u2192 1 + ' + MODEL.growth_weight + ' \u00d7 ln(1 + ' + run.growth_pct + '/100) = ' + run.growth_multiplier, 'growth multiplier'],
      ['Time with no token on record', (run.age === null ? 'no listing date, so ' + MODEL.unknown_age_days + ' days assumed' : run.age + ' days since ' + row.listed_at) + ' \u2192 ' + MODEL.maturity_floor + ' + min(age, ' + MODEL.maturity_days + ')/' + MODEL.maturity_days + ' \u00d7 ' + MODEL.maturity_range + ' = ' + run.maturity_multiplier, 'maturity multiplier'],
      ['Category: ' + (row.category || 'none on record'), '\u00d7 ' + run.category_multiplier.toFixed(2) + ' \u2014 ' + run.category_reason, 'value capture by sector'],
      ['Chain breadth: ' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's'), '\u00d7 ' + run.breadth_multiplier + ' \u2014 1 + ' + MODEL.breadth_weight + ' \u00d7 min(ln(chains)/ln(' + MODEL.breadth_chains + '), 1)', 'distribution, saturating'],
      ['Every term together', fmtUsd(run.size) + ' \u00d7 ' + run.growth_multiplier + ' \u00d7 ' + run.maturity_multiplier + ' \u00d7 ' + run.category_multiplier.toFixed(2) + ' \u00d7 ' + run.breadth_multiplier + ' = ' + fmtUsd(run.implied), 'the modelled implied value'],
    ];
    return el('ol', { class: 'arithmetic' }, lines.map(function (line) {
      return el('li', null,
        el('span', { class: 'step-label', text: line[0] }),
        el('code', { text: line[1] }),
        el('span', { class: 'sub', text: line[2] })
      );
    }));
  }

  function confidenceBlock(row) {
    var conf = Model.confidence(row, MODEL, FLOOR);
    return el('section', { class: 'detail-section' },
      el('h3', null, 'Confidence in this row ', el('span', { class: 'num', text: conf.score + ' / 100' })),
      el('p', { class: 'sub', text: 'Confidence is not value: it says how much of the record behind the estimate exists. It never moves a rank.' }),
      el('div', { class: 'confidence-grid' }, conf.parts.map(function (part) {
        return el('div', { class: 'confidence-part' },
          el('div', { class: 'value-line' },
            el('span', { text: part.label }),
            el('span', { class: 'num', text: part.points + ' / ' + part.max })
          ),
          el('div', { class: 'bar thin', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.round((part.points / part.max) * 100) + '%' })),
          el('span', { class: 'sub', text: part.note })
        );
      }))
    );
  }

  function planBlock(row) {
    var steps = Plan.farmSteps(row);
    return el('section', { class: 'detail-section' },
      el('h3', null, 'Farm plan ', el('span', { class: 'sub', text: steps.length + ' steps, each with a cost and a time' })),
      el('p', { class: 'sub', text: 'Generated from this protocol\u2019s own category, chains, TVL, seven-day change and age, by the plan module this page ships; the same generator wrote the plan in board.json.' }),
      el('ol', { class: 'steps' }, steps.map(function (step) {
        var at = step.indexOf(' Cost: ');
        var action = at >= 0 ? step.slice(0, at) : step;
        var tail = at >= 0 ? step.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost num', text: tail }));
      }))
    );
  }

  function openDetail(row) {
    state.selected = row.slug;
    writeHash();
    dialog.textContent = '';
    var head = el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'eyebrow', text: row.kind === 'live' ? 'Live token \u00b7 set aside from the ranking' : 'Rank ' + row.rank + ' of ' + RANKED.length + ' \u00b7 modelled, not a price' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'no category') + ' \u00b7 ' + ((row.chains || []).length ? row.chains.join(', ') : 'no chain listed') + (row.symbol ? ' \u00b7 ' + row.symbol : '') })
      ),
      el('button', { class: 'button', type: 'button', text: 'Close', onclick: function () { dialog.close(); } })
    );
    dialog.appendChild(head);
    if (row.kind === 'live') {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Market facts, not a model' }),
        el('div', { class: 'figures' },
          figure('TVL', fmtUsd(row.tvl_usd)),
          figure('Market cap', fmtUsd(row.mcap_usd), 'the market\u2019s own number'),
          figure('Seven-day TVL change', fmtPct(row.change_7d)),
          figure('Token', row.symbol || 'unnamed', 'already recorded by DefiLlama')
        ),
        el('p', { class: 'sub', text: 'This protocol\u2019s token already trades, so the radar does not model a value for it: its market cap is a fact, and it holds no rank. The board\u2019s own ranking is the pre-token set; switch the token-status filter back to \u201cNo token\u201d to see it.' })
      ));
      return show();
    }
    var run = Model.impliedValue(row, MODEL);
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'The snapshot\u2019s figures for this protocol' }),
      el('div', { class: 'figures' },
        figure('TVL', fmtUsd(row.tvl_usd), 'whole dollars, from the snapshot'),
        figure('Seven-day growth', fmtPct(row.change_7d), row.change_7d === null ? 'unreported' : 'the snapshot\u2019s own change'),
        figure('Age with no token', fmtAge(row.age_days), row.listed_at ? 'listed ' + row.listed_at : 'no listing date'),
        figure('Chains', String((row.chains || []).length), (row.chains || []).join(', ') || 'none listed'),
        figure('Category', row.category || 'none', 'DefiLlama\u2019s own label'),
        figure('Implied value', fmtUsd(row.implied_value_usd), 'rank ' + row.rank + ' on the board')
      )
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'The model\u2019s arithmetic, step by step' }),
      arithmeticList(row, run),
      el('p', { class: 'sub', text: 'This page recomputes the row as ' + fmtUsd(run.implied) + (run.implied === row.implied_value_usd
        ? ' \u2014 the same number board.json carries.'
        : ' \u2014 which differs from the board, so the data is stale against this code.') })
    ));
    dialog.appendChild(confidenceBlock(row));
    dialog.appendChild(planBlock(row));
    show();
  }

  function show() {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('p', { text: 'Every figure comes from one sealed snapshot of DefiLlama\u2019s public protocol index (' + DATA.as_of + '), read once. The page holds no network code: the data is the data.js file beside it.' }),
      el('p', { class: 'sub', text: 'Implied value is this entry\u2019s own estimate of what an unrealised token would be worth if the protocol\u2019s record stayed as it is. It claims nothing about whether or when a token is issued, and a farm plan describes activity, not a promised reward.' })
    );
  }

  function render() {
    app.textContent = '';
    app.appendChild(el('div', { class: 'shell' },
      header(),
      hero(),
      formulaPanel(),
      controls(),
      boardTable(),
      footer()
    ));
    app.setAttribute('aria-busy', 'false');
    if (state.selected !== null) {
      var row = allRows().filter(function (r) { return r.slug === state.selected; })[0];
      if (row) openDetail(row);
    }
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('status')) state.status = params.get('status');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.status !== 'pre') params.set('status', state.status);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    try {
      window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
    } catch (err) {
      window.location.hash = next;
    }
  }

  // A small hook so a test can drive the page without a browser: the parsed rows, the filter, the
  // sort, the model and the plan generator, all the same functions the page itself renders with.
  window.__radarTest = {
    data: DATA,
    rows: RANKED,
    live: LIVE,
    model: function (row) { return Model.impliedValue(row, MODEL); },
    confidence: function (row) { return Model.confidence(row, MODEL, FLOOR); },
    farmSteps: Plan.farmSteps,
    modelVersion: Model.MODEL_VERSION,
    filter: filterRows,
    sort: sortRows,
    state: state,
    setState: function (patch) {
      Object.keys(patch).forEach(function (key) { state[key] = patch[key]; });
      render();
    },
    render: render,
    protocolCount: allRows().length,
  };

  dialog.addEventListener('close', function () {
    state.selected = null;
    writeHash();
    var selected = document.querySelector('tr[data-selected="true"]');
    if (selected) selected.setAttribute('data-selected', 'false');
  });
  app.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && dialog.open) dialog.close();
  });

  readHash();
  render();
})();


