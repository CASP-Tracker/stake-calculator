/* Stake Calculator for EU
   Plain JS, no dependencies. Rates live in data/rates.js (window.STAKING_DATA). */
(function () {
  'use strict';

  var D = window.STAKING_DATA;
  if (!D) return;

  var ASSETS = D.assets;
  var EX = D.exchanges;
  var COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
  EX.forEach(function (e, i) { e.color = COLORS[i % COLORS.length]; });

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function assetBy(sym) { return ASSETS.filter(function (a) { return a.symbol === sym; })[0]; }

  /* ---------- state ---------- */
  var state = { asset: ASSETS[0].symbol, amount: 10000, unit: 'eur', months: 12, rcase: 'mid', compound: true, prod: {}, details: false };
  var EUR_PRESETS = [1000, 5000, 10000, 50000];
  var DUR_PRESETS = [[3, '3 mo'], [6, '6 mo'], [12, '1 yr'], [24, '2 yr'], [36, '3 yr'], [60, '5 yr']];

  function loadUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('a') && assetBy(q.get('a'))) state.asset = q.get('a');
      if (q.get('u') === 'coin') state.unit = 'coin';
      var amt = parseFloat(q.get('amt'));
      if (isFinite(amt) && amt > 0 && amt < 1e12) state.amount = amt;
      else if (state.unit === 'coin') state.amount = assetBy(state.asset).defaultCoin;
      var m = parseInt(q.get('m'), 10);
      if (m >= 1 && m <= 60) state.months = m;
      if (['low', 'mid', 'high'].indexOf(q.get('c')) > -1) state.rcase = q.get('c');
      if (q.get('r') === '0') state.compound = false;
    } catch (e) { /* ignore */ }
  }
  function saveUrl() {
    try {
      var q = new URLSearchParams();
      q.set('a', state.asset);
      q.set('amt', String(state.amount));
      q.set('u', state.unit);
      q.set('m', String(state.months));
      q.set('c', state.rcase);
      q.set('r', state.compound ? '1' : '0');
      history.replaceState(null, '', '?' + q.toString());
    } catch (e) { /* file:// or sandboxed, ignore */ }
  }

  /* ---------- formatting ---------- */
  var nfCache = {};
  function nf(key, opts) { return nfCache[key] || (nfCache[key] = new Intl.NumberFormat('en-IE', opts)); }
  function money(x) {
    var a = Math.abs(x);
    var d = a !== 0 && a < 100 ? 2 : 0;
    return nf('m' + d, { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  }
  function coin(x, sym) {
    var a = Math.abs(x);
    var d = a === 0 ? 0 : a < 0.01 ? 6 : a < 1 ? 5 : a < 100 ? 4 : 2;
    return nf('c' + d, { minimumFractionDigits: 0, maximumFractionDigits: d }).format(x) + ' ' + sym;
  }
  function fmt(x) { return state.unit === 'eur' ? money(x) : coin(x, state.asset); }
  function fmtSigned(x) { return '+' + fmt(x); }
  function fmtAxis(v) {
    var s = nf('ax', { notation: 'compact', maximumSignificantDigits: 3 }).format(v);
    return state.unit === 'eur' ? '€' + s : s;
  }
  function pct(x) { return String(Number(x.toFixed(2))) + '%'; }
  function dateLong(iso) {
    var d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  function dateShort(iso) {
    var d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  function durText(m) {
    var y = Math.floor(m / 12), r = m % 12, out = [];
    if (y) out.push(y + (y === 1 ? ' year' : ' years'));
    if (r) out.push(r + (r === 1 ? ' month' : ' months'));
    return out.join(' ');
  }

  /* ---------- model ---------- */
  function products(ex) { return (ex.products && ex.products[state.asset]) || []; }
  function selected(ex) {
    var arr = products(ex);
    if (!arr.length) return null;
    var id = state.prod[ex.key + ':' + state.asset];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return arr[0];
  }
  /* Net factor: commission is taken from the rewards, and some products only
     earn on part of the stake. Published figures are kept on the product. */
  function net(p) { return (1 - (p.fee || 0) / 100) * (p.share == null ? 1 : p.share); }
  function grossOf(p, c) { return c === 'low' ? p.min : c === 'high' ? p.max : (p.min + p.max) / 2; }
  function rateOf(p, c) { return grossOf(p, c) * net(p); }

  /* Balance after `months` for a principal P at a published annual rate.
     APR + compounding: monthly reinvestment. APY + compounding: used as published.
     Without compounding an APY is first turned into its nominal equivalent so the
     simple-interest line is not overstated. */
  function balanceAt(P, ratePct, kind, months, compound) {
    var r = ratePct / 100, t = months / 12;
    if (kind === 'APY') {
      if (compound) return P * Math.pow(1 + r, t);
      var nominal = 12 * (Math.pow(1 + r, 1 / 12) - 1);
      return P * (1 + nominal * t);
    }
    if (compound) return P * Math.pow(1 + r / 12, months);
    return P * (1 + r * t);
  }
  function rewardAt(p, months) {
    var compound = state.compound && p.compounds !== false;
    return balanceAt(state.amount, rateOf(p, state.rcase), p.kind, months, compound) - state.amount;
  }
  /* effective annual yield, to rank rows that are labelled APR or APY fairly */
  function eay(p, c) {
    var r = rateOf(p, c) / 100;
    return p.kind === 'APY' ? r : (state.compound && p.compounds !== false ? Math.pow(1 + r / 12, 12) - 1 : r);
  }

  function niceTicks(max, n) {
    n = n || 4;
    if (!(max > 0)) return { step: 1, max: 1 };
    var raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    return { step: step, max: Math.ceil(max / step - 1e-9) * step };
  }

  /* ---------- controls ---------- */
  function radioGroup(container, onSelect) {
    var btns = function () { return Array.prototype.slice.call(container.querySelectorAll('[role="radio"]')); };
    function sync() {
      btns().forEach(function (b) { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
    }
    container.addEventListener('click', function (e) {
      var b = e.target.closest('[role="radio"]');
      if (!b || !container.contains(b)) return;
      onSelect(b);
      sync();
    });
    container.addEventListener('keydown', function (e) {
      var k = e.key;
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].indexOf(k) < 0) return;
      var list = btns(), i = list.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var n = list[(i + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : list.length - 1)) % list.length];
      n.focus();
      n.click();
    });
    return sync;
  }
  function setChecked(container, pred) {
    Array.prototype.forEach.call(container.querySelectorAll('[role="radio"]'), function (b) {
      b.setAttribute('aria-checked', pred(b) ? 'true' : 'false');
      b.tabIndex = pred(b) ? 0 : -1;
    });
  }

  var assetChips = $('asset-chips');
  function buildAssets() {
    assetChips.innerHTML = ASSETS.map(function (a) {
      return '<button type="button" class="chip" role="radio" data-asset="' + a.symbol + '" aria-checked="false">' +
        '<span class="coin" style="background:' + a.color + (a.symbol.length > 3 ? ';font-size:8px' : '') + '" aria-hidden="true">' + esc(a.symbol) + '</span>' +
        '<span>' + esc(a.symbol) + '</span></button>';
    }).join('');
  }

  function buildPresets() {
    var host = $('presets');
    if (state.unit === 'eur') {
      host.innerHTML = EUR_PRESETS.map(function (v) {
        return '<button type="button" data-v="' + v + '" aria-pressed="' + (state.amount === v) + '">' + money(v) + '</button>';
      }).join('');
    } else {
      var a = assetBy(state.asset);
      host.innerHTML = a.presets.map(function (v) {
        return '<button type="button" data-v="' + v + '" aria-pressed="' + (state.amount === v) + '">' + coin(v, a.symbol) + '</button>';
      }).join('');
    }
    $('duration-presets').innerHTML = DUR_PRESETS.map(function (d) {
      return '<button type="button" data-m="' + d[0] + '" aria-pressed="' + (state.months === d[0]) + '">' + d[1] + '</button>';
    }).join('');
  }

  function syncControls() {
    setChecked(assetChips, function (b) { return b.getAttribute('data-asset') === state.asset; });
    setChecked($('unit-seg'), function (b) { return b.getAttribute('data-unit') === state.unit; });
    setChecked($('case-seg'), function (b) { return b.getAttribute('data-case') === state.rcase; });
    $('unit-coin').textContent = state.asset;
    $('months').value = state.months;
    $('months-out').textContent = durText(state.months);
    $('compound').checked = state.compound;
    var inp = $('amount');
    if (document.activeElement !== inp) inp.value = String(state.amount);
    inp.removeAttribute('aria-invalid');
    $('amount-hint').textContent = state.unit === 'eur'
      ? 'Rewards are shown in EUR, at a constant ' + state.asset + ' price.'
      : 'Rewards are shown in ' + state.asset + '.';
    buildPresets();
  }

  function bind() {
    var syncAsset = radioGroup(assetChips, function (b) {
      state.asset = b.getAttribute('data-asset');
      if (state.unit === 'coin') state.amount = assetBy(state.asset).defaultCoin;
      update();
    });
    var syncUnit = radioGroup($('unit-seg'), function (b) {
      var u = b.getAttribute('data-unit');
      if (u === state.unit) return;
      state.unit = u;
      state.amount = u === 'eur' ? 10000 : assetBy(state.asset).defaultCoin;
      update();
    });
    var syncCase = radioGroup($('case-seg'), function (b) {
      state.rcase = b.getAttribute('data-case');
      update();
    });
    syncAsset(); syncUnit(); syncCase();

    $('amount').addEventListener('input', function (e) {
      var raw = e.target.value.replace(/[\s ]/g, '').replace(',', '.');
      var v = parseFloat(raw);
      if (!/^\d*\.?\d*$/.test(raw) || !isFinite(v) || v <= 0 || v >= 1e12) {
        e.target.setAttribute('aria-invalid', 'true');
        $('amount-hint').textContent = 'Enter a number above 0.';
        return;
      }
      e.target.removeAttribute('aria-invalid');
      $('amount-hint').textContent = state.unit === 'eur'
        ? 'Rewards are shown in EUR, at a constant ' + state.asset + ' price.'
        : 'Rewards are shown in ' + state.asset + '.';
      state.amount = v;
      render();
      buildPresets();
      saveUrl();
    });
    $('amount').addEventListener('blur', function (e) { e.target.value = String(state.amount); e.target.removeAttribute('aria-invalid'); });

    $('presets').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (!b) return;
      state.amount = parseFloat(b.getAttribute('data-v'));
      update();
    });
    $('duration-presets').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]');
      if (!b) return;
      state.months = parseInt(b.getAttribute('data-m'), 10);
      update();
    });
    $('months').addEventListener('input', function (e) {
      state.months = parseInt(e.target.value, 10);
      $('months-out').textContent = durText(state.months);
      render();
      buildPresets();
      saveUrl();
    });
    $('compound').addEventListener('change', function (e) { state.compound = e.target.checked; update(); });

    $('cards').addEventListener('click', function (ev) {
      if (!ev.target.closest('[data-more]')) return;
      state.details = !state.details;
      Array.prototype.forEach.call($('cards').querySelectorAll('[data-more]'), function (b) { b.setAttribute('aria-expanded', String(state.details)); });
      Array.prototype.forEach.call($('cards').querySelectorAll('.c-detail'), function (p) { p.hidden = !state.details; });
    });
    $('cards').addEventListener('change', function (e) {
      var s = e.target.closest('select[data-ex]');
      if (!s) return;
      state.prod[s.getAttribute('data-ex') + ':' + state.asset] = s.value;
      render();
      var again = $('cards').querySelector('select[data-ex="' + s.getAttribute('data-ex') + '"]');
      if (again) again.focus();
    });

    $('matrix').addEventListener('click', function (e) {
      var tr = e.target.closest('tr.mx-row');
      var b = tr && tr.querySelector('[data-asset-row]');
      if (!b) return;
      state.asset = b.getAttribute('data-asset-row');
      if (state.unit === 'coin') state.amount = assetBy(state.asset).defaultCoin;
      update();
      $('h-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    var raf = 0;
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { renderGrowth(); });
      }).observe($('growth-chart'));
    } else {
      window.addEventListener('resize', function () { renderGrowth(); });
    }
    bindHover();
  }

  /* ---------- cards ---------- */
  function protIcon(level) {
    return level === 'none'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.7 14a6.9 6.9 0 0 0 .3-2V5l-8-3-3.2 1.2"/><path d="m2 2 20 20"/><path d="M4.7 4.7 4 5v7c0 6 8 10 8 10a20.3 20.3 0 0 0 5.6-4.4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  }
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function renderCards() {
    var host = $('cards');
    var focusEx = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ex');
    var rows = EX.map(function (ex) {
      var p = selected(ex);
      return { ex: ex, p: p, reward: p ? rewardAt(p, state.months) : null };
    });
    var withData = rows.filter(function (r) { return r.p; });
    /* a lock-up longer than the chosen duration cannot be completed, so it is never "highest" */
    var usable = withData.filter(function (r) { return !(r.p.termDays > 0 && state.months * 30 < r.p.termDays); });
    var best = null;
    if (usable.length > 1) {
      best = usable.reduce(function (a, b) { return b.reward > a.reward ? b : a; });
      if (usable.every(function (r) { return Math.abs(r.reward - best.reward) < 1e-9; })) best = null;
    }

    host.innerHTML = rows.map(function (r) {
      var ex = r.ex, p = r.p;
      var isBest = best && best.ex === ex;
      var head = '<div class="c-head"><img class="logo" src="' + esc(ex.logo) + '" alt="' + esc(ex.name) + '" width="36" height="36">' +
        '<h3>' + esc(ex.name) + '</h3>' + (isBest ? '<span class="badge">Highest reward</span>' : '') + '</div>';

      if (!p) {
        var why = (ex.unavailable && ex.unavailable[state.asset]) || 'No staking product found for ' + state.asset + ' for EU clients.';
        return '<article class="card dim">' + head + '<div class="c-na"><strong>Not available</strong>' + esc(why) + '</div></article>';
      }

      var arr = products(ex);
      var prod = arr.length > 1
        ? '<div class="c-prod"><label class="sr" for="p-' + ex.key + '">Product on ' + esc(ex.name) + '</label><select id="p-' + ex.key + '" data-ex="' + ex.key + '">' +
          arr.map(function (x) {
            return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.label) + '</option>';
          }).join('') + '</select></div>'
        : '<div class="c-prod">' + esc(p.label) + '</div>';

      var rate = rateOf(p, state.rcase);
      var bal = state.amount + r.reward;
      var rateSub = [];
      if (net(p) < 1) {
        var why2 = [];
        if (p.fee) why2.push(p.fee + '% commission');
        if (p.share != null && p.share < 1) why2.push('earns on ' + Math.round(p.share * 100) + '% of the stake');
        rateSub.push('<small>' + esc(pct(grossOf(p, state.rcase)) + ' published, after ' + why2.join(', ')) + '</small>');
      }
      if (p.promo) rateSub.push('<small class="warn">Promo rate, may drop</small>');
      if (p.compounds === false) rateSub.push('<small>Simple interest, not compounded</small>');
      if (p.tiered) rateSub.push('<small class="warn">Depends on balance tiers</small>');
      if (p.min !== p.max) rateSub.push('<small>Published ' + esc(pct(p.min)) + ' to ' + esc(pct(p.max)) + '</small>');

      var lockText = p.termDays > 0 ? p.termDays + ' days' : (p.lock || 'Flexible');
      var lockSub = (p.termDays > 0 && state.months * 30 < p.termDays)
        ? '<small class="warn">Longer than your ' + esc(durText(state.months)) + '</small>' : '';

      var prot = ex.prot || { level: 'unknown', short: 'Status not stated', long: '' };
      var detail = '<dl>' +
        '<dt>Product</dt><dd>' + esc(p.label) + '</dd>' +
        '<dt>Protection</dt><dd>' + esc(prot.long) + '</dd>' +
        (p.note ? '<dt>Good to know</dt><dd>' + esc(p.note) + '</dd>' : '') +
        (p.minAmount ? '<dt>Minimum</dt><dd>' + esc(p.minAmount) + '</dd>' : '') +
        (p.eu === 'unknown' ? '<dt>EU availability</dt><dd>Could not be confirmed.</dd>' : '') +
        '<dt>Exchange licence</dt><dd>' + esc(ex.entity) + ', ' + esc(ex.authorityShort) + ' (' + esc(ex.country) + '), licensed ' + esc(dateShort(ex.licenceDate)) +
        '. <a href="' + esc(ex.verifyUrl) + '" rel="noopener">Verify</a></dd>' +
        '<dt>Source</dt><dd><a href="' + esc(p.source) + '" rel="noopener nofollow" target="_blank">' + esc(ex.name) + ' page</a>, read ' + esc(dateShort(p.readOn)) + '</dd>' +
        '</dl>';

      return '<article class="card">' + head + prod +
        '<div class="c-reward"><div class="big">' + esc(fmtSigned(r.reward)) + '</div>' +
        '<div class="sub">after ' + esc(durText(state.months)) + ', balance ' + esc(fmt(bal)) + '</div></div>' +
        '<div class="c-row"><span>Rate</span><span class="v">' + esc(pct(rate)) + ' ' + esc(p.kind) + (net(p) < 1 ? ' net' : '') + rateSub.join('') + '</span></div>' +
        '<div class="c-row"><span>Lock-up</span><span class="v">' + esc(lockText) + lockSub + '</span></div>' +
        '<div class="c-prot"><span class="pill ' + esc(prot.level) + '">' + protIcon(prot.level) + esc(prot.short) + '</span></div>' +
        '<div class="c-more"><button type="button" class="more-btn" data-more aria-expanded="' + state.details + '" aria-controls="det-' + ex.key + '"><span>Details, all cards</span>' + CHEV + '</button>' +
        '<div class="c-detail" id="det-' + ex.key + '"' + (state.details ? '' : ' hidden') + '>' + detail + '</div></div>' +
        '</article>';
    }).join('');

    if (focusEx) {
      var again = host.querySelector('select[data-ex="' + focusEx + '"]');
      if (again) again.focus();
    }
    /* the low / middle / high switch only means something when a published rate is a range */
    $('case-field').hidden = !EX.some(function (e) { var p = selected(e); return p && p.min !== p.max; });
    $('results-sub').textContent = state.asset + ', ' + fmt(state.amount) + ', ' + durText(state.months);
  }

  /* ---------- growth chart ---------- */
  var geom = null;

  function renderGrowth() {
    var host = $('growth-chart');
    var series = EX.map(function (ex) { return { ex: ex, p: selected(ex) }; }).filter(function (s) { return s.p; });
    $('growth-note').textContent = 'Cumulative rewards on ' + fmt(state.amount) + ' of ' + state.asset + (state.compound ? ', reinvested.' : ', not reinvested.');
    if (!series.length) { host.innerHTML = '<p class="rr-none">No staking data for ' + esc(state.asset) + '.</p>'; geom = null; return; }

    var W = Math.max(280, host.clientWidth - 24);
    var narrow = W < 520;
    var H = narrow ? 260 : 320;
    var ml = narrow ? 48 : 60, mr = narrow ? 64 : 124, mt = 12, mb = 30;
    var M = state.months;
    var pts = series.map(function (s) {
      var a = new Array(M + 1);
      for (var m = 0; m <= M; m++) a[m] = m === 0 ? 0 : rewardAt(s.p, m);
      return a;
    });
    var maxV = Math.max.apply(null, pts.map(function (a) { return a[M]; }).concat([0]));
    var nt = niceTicks(maxV);
    var pw = W - ml - mr;
    function x(m) { return ml + (m / M) * pw; }
    function y(v) { return mt + (1 - v / nt.max) * (H - mt - mb); }

    var out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" style="touch-action:pan-y" aria-label="' +
      esc('Cumulative rewards over ' + durText(M) + ' for ' + state.asset + '. ' + series.map(function (s, i) { return s.ex.name + ' ' + fmtSigned(pts[i][M]); }).join(', ') + '.') + '">');

    for (var v = 0; v <= nt.max + nt.step * 0.01; v += nt.step) {
      out.push('<line class="gridline" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>');
      out.push('<text x="' + (ml - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmtAxis(v)) + '</text>');
    }
    var steps = [1, 2, 3, 6, 12, 24], xs = 1;
    for (var k = 0; k < steps.length; k++) { xs = steps[k]; if (M / xs <= (narrow ? 5 : 8)) break; }
    for (var m2 = 0; m2 <= M; m2 += xs) {
      var lab = m2 === 0 ? '0' : (M > 12 && m2 % 12 === 0 ? (m2 / 12) + 'y' : m2 + 'm');
      out.push('<text x="' + x(m2) + '" y="' + (H - 10) + '" text-anchor="' + (m2 === 0 ? 'start' : 'middle') + '">' + lab + '</text>');
    }
    out.push('<line class="axis" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>');

    series.forEach(function (s, i) {
      var d = pts[i].map(function (v2, m) { return (m ? 'L' : 'M') + x(m).toFixed(1) + ' ' + y(v2).toFixed(1); }).join('');
      out.push('<path d="' + d + '" fill="none" style="stroke:' + s.ex.color + '" stroke-width="2.75" stroke-linejoin="round" stroke-linecap="round"/>');
    });

    var ends = series.map(function (s, i) { return { i: i, y: y(pts[i][M]) }; }).sort(function (a, b) { return a.y - b.y; });
    for (var e = 1; e < ends.length; e++) if (ends[e].y - ends[e - 1].y < 15) ends[e].y = ends[e - 1].y + 15;
    ends.forEach(function (en) {
      var s = series[en.i];
      out.push('<text class="lbl" x="' + (W - mr + 8) + '" y="' + (en.y + 4) + '" style="fill:' + s.ex.color + '">' + esc(s.ex.name) +
        (narrow ? '' : ' <tspan style="fill:var(--ink)">' + esc(fmtSigned(pts[en.i][M])) + '</tspan>') + '</text>');
    });

    out.push('<g id="hv" visibility="hidden"><line id="hv-line" y1="' + mt + '" y2="' + y(0) + '" stroke="var(--ink-soft)" stroke-dasharray="3 3"/>');
    series.forEach(function (s, i) {
      out.push('<circle class="hv-dot" r="5" style="fill:' + s.ex.color + '" stroke="var(--surface)" stroke-width="2"/>');
    });
    out.push('</g>');
    out.push('<rect id="hv-hit" x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + (H - mt - mb) + '" fill="transparent"/>');
    out.push('</svg><div class="tip" id="tip" hidden></div>');
    host.innerHTML = out.join('');
    geom = { W: W, H: H, ml: ml, mr: mr, mt: mt, pw: pw, M: M, series: series, pts: pts, x: x, y: y };

    renderGrowthTable(series, pts);
  }

  function bindHover() {
    var host = $('growth-chart');
    function hide() {
      var hv = host.querySelector('#hv'), tip = host.querySelector('#tip');
      if (hv) hv.setAttribute('visibility', 'hidden');
      if (tip) tip.hidden = true;
    }
    host.addEventListener('pointermove', function (e) {
      if (!geom) return;
      var svg = host.querySelector('svg');
      if (!svg) return;
      var r = svg.getBoundingClientRect();
      var px = (e.clientX - r.left) * (geom.W / r.width);
      if (px < geom.ml - 6 || px > geom.W - geom.mr + 6) { hide(); return; }
      var m = Math.max(0, Math.min(geom.M, Math.round(((px - geom.ml) / geom.pw) * geom.M)));
      var hv = host.querySelector('#hv'), line = host.querySelector('#hv-line'), tip = host.querySelector('#tip');
      var dots = host.querySelectorAll('.hv-dot');
      hv.setAttribute('visibility', 'visible');
      line.setAttribute('x1', geom.x(m)); line.setAttribute('x2', geom.x(m));
      geom.series.forEach(function (s, i) {
        dots[i].setAttribute('cx', geom.x(m)); dots[i].setAttribute('cy', geom.y(geom.pts[i][m]));
      });
      tip.innerHTML = '<b>' + (m === 0 ? 'Start' : 'After ' + esc(durText(m))) + '</b>' + geom.series.map(function (s, i) {
        return '<div><span><i style="background:' + s.ex.color + '"></i>' + esc(s.ex.name) + '</span><span>' + esc(fmtSigned(geom.pts[i][m])) + '</span></div>';
      }).join('');
      tip.hidden = false;
      var hr = host.getBoundingClientRect();
      var left = (geom.x(m) * (r.width / geom.W)) + (r.left - hr.left) + 14;
      if (left + tip.offsetWidth > hr.width - 6) left = left - tip.offsetWidth - 28;
      tip.style.left = Math.max(6, left) + 'px';
      tip.style.top = (12 + (r.top - hr.top)) + 'px';
    });
    host.addEventListener('pointerleave', hide);
  }

  function renderGrowthTable(series, pts) {
    var M = state.months, marks = [1, 3, 6, 12, 24, 36, 48, 60].filter(function (m) { return m < M; }).concat([M]);
    var head = '<tr><th scope="col">After</th>' + series.map(function (s) { return '<th scope="col">' + esc(s.ex.name) + '</th>'; }).join('') + '</tr>';
    var body = marks.map(function (m) {
      return '<tr><th scope="row">' + esc(durText(m)) + '</th>' + series.map(function (s, i) { return '<td>' + esc(fmtSigned(pts[i][m])) + '</td>'; }).join('') + '</tr>';
    }).join('');
    $('growth-table').innerHTML = '<table><caption class="sr">Cumulative rewards by exchange</caption><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  /* ---------- rate range chart ---------- */
  function renderRange() {
    var host = $('range-chart');
    var rows = EX.map(function (ex) { return { ex: ex, p: selected(ex) }; });
    $('range-note').textContent = 'Annual rate for ' + state.asset + ', after exchange commission where one applies.' + (EX.some(function (e) { var p = selected(e); return p && p.min !== p.max; }) ? ' The black marker is the rate used in the calculator.' : '');
    if (!rows.some(function (r) { return r.p; })) { host.innerHTML = '<p class="rr-none">No staking data for ' + esc(state.asset) + '.</p>'; return; }
    var top = Math.max.apply(null, rows.map(function (r) { return r.p ? r.p.max * net(r.p) : 0; }));
    var nt = niceTicks(top, 4);
    var max = nt.max;
    var html = rows.map(function (r) {
      var ex = r.ex, p = r.p;
      var name = '<div class="rr-name"><img src="' + esc(ex.logo) + '" alt="" width="22" height="22"><span>' + esc(ex.name) + '</span></div>';
      if (!p) return '<div class="rr">' + name + '<div class="rr-none">Not available</div></div>';
      var nlo = p.min * net(p), nhi = p.max * net(p);
      var lo = (nlo / max) * 100, hi = (nhi / max) * 100, mk = (rateOf(p, state.rcase) / max) * 100;
      var txt = nlo === nhi ? pct(nhi) + ' ' + p.kind : pct(nlo) + ' to ' + pct(nhi) + ' ' + p.kind;
      var right = hi < 70;
      /* near the right edge the label sits inside the bar (single value) or left of it (range) */
      var inside = !right && nlo === nhi;
      var valStyle = right ? 'left:calc(' + hi + '% + 10px)' : inside ? 'right:calc(' + (100 - hi) + '% + 10px)' : 'right:calc(' + (100 - lo) + '% + 10px)';
      return '<div class="rr" style="--xc:' + ex.color + '">' + name + '<div class="rr-track"><div class="rr-axis"></div>' +
        (nlo === nhi
          ? '<div class="rr-bar" style="left:0;width:' + hi + '%"></div>'
          : '<div class="rr-bar rr-base" style="left:0;width:' + lo + '%"></div><div class="rr-bar" style="left:' + lo + '%;width:' + Math.max(hi - lo, 0.8) + '%"></div>' +
            '<div class="rr-dot" style="left:' + mk + '%"></div>') +
        '<div class="rr-val' + (inside ? ' rr-in' : '') + '" style="' + valStyle + '">' + esc(txt) + '</div></div></div>';
    }).join('');
    var ticks = '';
    for (var v = 0; v <= max + nt.step * 0.01; v += nt.step) {
      ticks += '<span style="left:' + (v / max * 100) + '%">' + esc(pct(v)) + '</span>';
    }
    host.innerHTML = html + '<div class="rr-scale"><span></span><div class="rr-ticks">' + ticks + '</div></div>';
  }

  /* ---------- matrix ---------- */
  function renderMatrix() {
    var head = '<tr><th scope="col">Coin</th>' + EX.map(function (ex) { return '<th scope="col">' + esc(ex.name) + '</th>'; }).join('') + '</tr>';
    var body = ASSETS.map(function (a) {
      var cells = EX.map(function (ex) {
        var arr = (ex.products && ex.products[a.symbol]) || [];
        return arr.length ? arr[0] : null;
      });
      var bestIdx = -1, bestV = -1;
      cells.forEach(function (p, i) {
        if (!p) return;
        var v = eay(p, 'mid');
        if (v > bestV + 1e-9) { bestV = v; bestIdx = i; }
      });
      var count = cells.filter(Boolean).length;
      var tds = cells.map(function (p, i) {
        if (!p) return '<td class="dash" title="No product found for EU clients">-</td>';
        var mid = ((p.min + p.max) / 2) * net(p);
        var t = pct(mid);
        return '<td' + (count > 1 && i === bestIdx ? ' class="mx-best"' : '') + ' title="' + esc(p.label + ', ' + (p.min === p.max ? pct(p.max) : pct(p.min) + ' to ' + pct(p.max)) + ' ' + p.kind + (net(p) < 1 ? ' published, shown after commission' : '')) + '">' + esc(t) + '</td>';
      }).join('');
      return '<tr class="mx-row"><th scope="row"><button type="button" class="mx-btn" data-asset-row="' + a.symbol + '"' + (a.symbol === state.asset ? ' aria-current="true"' : '') + '>' +
        '<span class="coin" style="background:' + a.color + (a.symbol.length > 3 ? ';font-size:8px' : '') + '" aria-hidden="true">' + esc(a.symbol) + '</span>' + esc(a.symbol) + '</button></th>' + tds + '</tr>';
    }).join('');
    $('matrix').innerHTML = '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
    Array.prototype.forEach.call($('matrix').querySelectorAll('tr.mx-row'), function (tr) {
      var b = tr.querySelector('[data-asset-row]');
      tr.style.background = b.getAttribute('aria-current') ? 'var(--brand-tint)' : '';
    });
  }

  /* ---------- orchestration ---------- */
  function render() {
    renderCards();
    renderGrowth();
    renderRange();
  }
  function update() {
    syncControls();
    render();
    renderMatrix();
    saveUrl();
  }

  function init() {
    var asof = dateLong(D.asOf);
    $('asof').textContent = asof;
    $('asof2').textContent = asof;
    buildAssets();
    loadUrl();
    bind();
    update();
  }
  init();
})();
