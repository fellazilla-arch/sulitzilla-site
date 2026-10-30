(function () {
  'use strict';

  var P = window.FazzioPricing;
  var C = P.CONFIG;
  var peso = P.peso;
  var state = { downPayment: C.defaults.downPayment, monthlyPayment: C.defaults.monthlyPayment };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function fmtInt(n) {
    return Number(n).toLocaleString('en-PH');
  }

  function pct(n, decimals) {
    return n.toFixed(decimals == null ? 1 : decimals) + '%';
  }

  function monthsLabel(n) {
    return n + (n === 1 ? ' month' : ' months');
  }

  /** Month name `offset` months from now (Manila time); payment 1 is due next month. */
  function monthName(offset) {
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    var d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- inputs ----------

  function chips(sel, values, label, key) {
    var box = $(sel);
    box.innerHTML = values.map(function (v) {
      return '<button type="button" class="chip" data-v="' + v + '">' + esc(label(v)) + '</button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      state[key] = Number(b.dataset.v);
      sync();
      update();
    });
  }

  function moneyInput(sel, key, onChange) {
    var input = $(sel);
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^\d]/g, '');
      state[key] = raw === '' ? NaN : Number(raw);
      var pos = input.selectionStart;
      var before = input.value.length;
      input.value = raw === '' ? '' : fmtInt(Number(raw));
      var at = Math.max(0, pos + input.value.length - before);
      try { input.setSelectionRange(at, at); } catch (_) {}
      if (onChange) onChange();
      update();
    });
  }

  function sync() {
    $('#in-down').value = isFinite(state.downPayment) ? fmtInt(state.downPayment) : '';
    $('#in-monthly').value = isFinite(state.monthlyPayment) ? fmtInt(state.monthlyPayment) : '';
    $('#rng-monthly').value = isFinite(state.monthlyPayment) ? state.monthlyPayment : 0;
  }

  // ---------- output ----------

  function set(sel, text) {
    $(sel).textContent = text;
  }

  function update() {
    var r = P.calculate(state.downPayment, state.monthlyPayment);
    var p = r.plan;

    $('#warning').hidden = r.ok;
    $('#problems').innerHTML = r.problems.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('');
    $('#fixes').innerHTML = r.fixes.length
      ? '<span>Try:</span>' + r.fixes.map(function (f, i) {
          return '<button type="button" class="chip chip-fix" data-i="' + i + '">' + esc(f.label) + '</button>';
        }).join('')
      : '';
    $$('#fixes .chip-fix').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = r.fixes[Number(b.dataset.i)];
        if (f.downPayment != null) state.downPayment = f.downPayment;
        if (f.monthlyPayment != null) state.monthlyPayment = f.monthlyPayment;
        sync();
        update();
      });
    });
    document.querySelector('.results').classList.toggle('is-off', !r.ok);

    var downOk = isFinite(state.downPayment) ? Math.max(state.downPayment, C.minDownPayment) : C.minDownPayment;
    $('#hint-monthly').textContent = downOk < C.cashPrice
      ? 'With this down payment, the lowest monthly is ' + peso(P.lowestMonthly(C.cashPrice - downOk)) +
        ' (' + C.maxMonths + ' months).'
      : '';

    $$('#chips-down .chip').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.v) === state.downPayment); });
    $$('#chips-monthly .chip').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.v) === state.monthlyPayment); });

    if (!p) {
      ['#r-months', '#r-rate', '#r-total', '#d-down', '#d-monthly', '#d-last', '#d-borrowed', '#d-interest', '#d-end']
        .forEach(function (s) { set(s, '—'); });
      ['#r-months-sub', '#r-rate-sub', '#r-total-sub'].forEach(function (s) { set(s, ''); });
      $('#schedule tbody').innerHTML = '';
      return;
    }

    if (p.cash) {
      set('#r-months', 'Paid in full');
      set('#r-months-sub', 'No monthly payments');
      set('#r-rate', '0%');
      set('#r-rate-sub', 'No interest');
      set('#r-total', peso(p.total));
      set('#r-total-sub', 'Cash price');
      set('#d-down', peso(p.downPayment));
      ['#d-monthly', '#d-last', '#d-end'].forEach(function (s) { set(s, '—'); });
      set('#d-borrowed', peso(0));
      set('#d-interest', peso(0));
      $('#schedule tbody').innerHTML = '<tr><td colspan="4" class="muted">Nothing to pay monthly.</td></tr>';
      return;
    }

    var lastDiffers = p.months > 1 && p.finalPayment !== p.monthlyPayment;
    set('#r-months', monthsLabel(p.months));
    set('#r-months-sub', p.months >= 12 ? (Math.round((p.months / 12) * 10) / 10) + ' years' : '');
    set('#r-rate', pct(p.yearlyRatePct) + ' a year');
    set('#r-rate-sub', pct(p.monthlyRatePct, 2) + ' a month');
    set('#r-total', peso(p.total));
    set('#r-total-sub', peso(p.interest) + ' more than the cash price');

    set('#d-down', peso(p.downPayment));
    set('#d-monthly', peso(p.monthlyPayment) + ' × ' + (lastDiffers ? p.months - 1 : p.months));
    set('#d-last', lastDiffers ? peso(p.finalPayment) : 'Same as monthly');
    set('#d-borrowed', peso(p.borrowed));
    set('#d-interest', peso(p.interest));
    set('#d-end', monthName(p.months));

    var rows = ['<tr class="row-down"><td>Down payment</td><td>At handover</td><td class="num">' + peso(p.downPayment) +
      '</td><td class="num">' + peso(p.totalOfMonthly) + '</td></tr>'];
    p.schedule.forEach(function (s) {
      rows.push('<tr><td>' + s.number + '</td><td>' + monthName(s.number) + '</td><td class="num">' + peso(s.amount) +
        '</td><td class="num">' + peso(s.balance) + '</td></tr>');
    });
    rows.push('<tr class="row-total"><td colspan="2">Total</td><td class="num">' + peso(p.total) + '</td><td></td></tr>');
    $('#schedule tbody').innerHTML = rows.join('');
  }

  function renderComparison() {
    var down = C.defaults.downPayment;
    set('#cmp-down', peso(down));
    $('#compare tbody').innerHTML = P.comparison(down).map(function (c) {
      var ours = c.ours
        ? '<td class="hl">' + peso(c.ours.monthly) + '</td><td class="hl">' + peso(c.ours.total) +
          '</td><td class="hl"><strong>' + pct(c.ours.yearlyRatePct) + '</strong></td>'
        : '<td class="hl muted" colspan="3">Max ' + C.maxMonths + ' months</td>';
      return '<tr><th scope="row">' + c.months + '</th><td>' + peso(c.dealer.monthly) + '</td><td>' + peso(c.dealer.total) +
        '</td><td>' + pct(c.dealer.yearlyRatePct) + '</td>' + ours + '</tr>';
    }).join('');
  }

  // ---------- boot ----------

  set('#cash-price', peso(C.cashPrice));
  set('#max-months', String(C.maxMonths));
  $('#late-rule').innerHTML = P.lateRuleLines().map(function (l) {
    var d = document.createElement('li');
    d.textContent = l;
    return d.outerHTML;
  }).join('');
  chips('#chips-down', [10000, 15000, 20000, 30000].filter(function (v) { return v >= C.minDownPayment; }), peso, 'downPayment');
  chips('#chips-monthly', [2500, 3000, 3500, 4000, 5000], peso, 'monthlyPayment');

  var rng = $('#rng-monthly');
  rng.min = 1000;
  rng.max = 10000;
  rng.addEventListener('input', function () {
    state.monthlyPayment = Number(rng.value);
    $('#in-monthly').value = fmtInt(state.monthlyPayment);
    update();
  });
  moneyInput('#in-down', 'downPayment');
  moneyInput('#in-monthly', 'monthlyPayment', function () {
    if (isFinite(state.monthlyPayment)) rng.value = state.monthlyPayment;
  });

  var box = $('#schedule-box');
  var wasOpen = false;
  window.addEventListener('beforeprint', function () { wasOpen = box.open; box.open = true; });
  window.addEventListener('afterprint', function () { box.open = wasOpen; });
  $('#btn-print').addEventListener('click', function () { window.print(); });

  renderComparison();
  sync();
  update();
})();
