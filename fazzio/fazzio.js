(function () {
  'use strict';

  var P = window.FazzioPricing;
  var C = P.CONFIG;
  var peso = P.peso;
  var state = { downPayment: C.defaults.downPayment, monthlyPayment: C.defaults.monthlyPayment };
  var entered = { downPayment: false, monthlyPayment: false };

  var $ = function (s) { return document.querySelector(s); };
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

  function moneyInput(sel, key) {
    var input = $(sel);
    input.addEventListener('focus', function () { input.select(); });
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^\d]/g, '');
      state[key] = raw === '' ? NaN : Number(raw);
      entered[key] = raw !== '';
      var pos = input.selectionStart;
      var before = input.value.length;
      input.value = raw === '' ? '' : fmtInt(Number(raw));
      var at = Math.max(0, pos + input.value.length - before);
      try { input.setSelectionRange(at, at); } catch (_) {}
      update();
    });
  }

  function sync() {
    $('#in-down').value = isFinite(state.downPayment) ? fmtInt(state.downPayment) : '';
    $('#in-monthly').value = isFinite(state.monthlyPayment) ? fmtInt(state.monthlyPayment) : '';
  }

  // ---------- output ----------

  function set(sel, text) {
    $(sel).textContent = text;
  }

  function update() {
    var r = P.calculate(state.downPayment, state.monthlyPayment);
    var p = r.ok ? r.plan : null;

    $('#warning').hidden = r.ok || !(entered.downPayment && entered.monthlyPayment);
    $('#problems').innerHTML = r.problems.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('');
    document.querySelector('.results').classList.toggle('is-off', !r.ok);

    var downOk = isFinite(state.downPayment) ? Math.max(state.downPayment, C.minDownPayment) : C.minDownPayment;
    $('#hint-monthly').textContent = downOk < C.cashPrice
      ? 'With this down payment, the lowest monthly is ' + peso(P.lowestMonthly(C.cashPrice - downOk)) +
        ' (' + C.maxMonths + ' months).'
      : '';


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
      $('#schedule tbody').innerHTML = '<tr><td colspan="5" class="muted">Nothing to pay monthly.</td></tr>';
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
      '</td><td class="num">' + peso(p.totalOfMonthly) + '</td><td class="num">' + peso(p.borrowed) + '</td></tr>'];
    p.schedule.forEach(function (s) {
      rows.push('<tr><td>' + s.number + '</td><td>' + monthName(s.number) + '</td><td class="num">' + peso(s.amount) +
        '</td><td class="num">' + peso(s.balance) + '</td><td class="num">' + (s.balance ? peso(s.payoff) : '—') + '</td></tr>');
    });
    rows.push('<tr class="row-total"><td colspan="2">Total</td><td class="num">' + peso(p.total) + '</td><td></td><td></td></tr>');
    $('#schedule tbody').innerHTML = rows.join('');
  }

  function renderComparison() {
    var down = C.compareDownPayment;
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
  set('#max-months-hint', String(C.maxMonths));
  $('#late-rule').innerHTML = P.lateRuleLines().map(function (l) {
    var d = document.createElement('li');
    d.textContent = l;
    return d.outerHTML;
  }).join('');
  moneyInput('#in-down', 'downPayment');
  moneyInput('#in-monthly', 'monthlyPayment');

  var box = $('#schedule-box');
  var wasOpen = false;
  window.addEventListener('beforeprint', function () { wasOpen = box.open; box.open = true; });
  window.addEventListener('afterprint', function () { box.open = wasOpen; });
  $('#btn-print').addEventListener('click', function () { window.print(); });

  renderComparison();
  sync();
  update();
})();
