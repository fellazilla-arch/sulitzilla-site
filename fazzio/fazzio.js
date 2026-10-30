(function () {
  'use strict';

  var P = window.FazzioPricing;
  var peso = P.peso;
  var cfg = P.mergeConfig({});
  var state = { mode: 'monthly', downPayment: 0, monthlyPayment: 0, termMonths: 12, handoverDate: '' };
  var lastResult = null;
  var submitted = null;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtInt(n) {
    return Number(n).toLocaleString('en-PH');
  }

  function fmtDate(iso, long) {
    if (!iso) return '—';
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.toLocaleDateString('en-PH', {
      timeZone: 'UTC',
      year: 'numeric',
      month: long ? 'long' : 'short',
      day: 'numeric',
    });
  }

  function pct(n) {
    return (Math.round(n * 100) / 100).toFixed(2).replace(/0$/, '') + '%';
  }

  function todayManila() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date());
    return parts;
  }

  function monthsLabel(n) {
    return n + (n === 1 ? ' month' : ' months');
  }

  // ---------- static, config-driven content ----------

  function bindConfig() {
    $$('[data-cfg]').forEach(function (el) {
      var v = get(cfg, el.getAttribute('data-cfg'));
      var f = el.getAttribute('data-fmt');
      if (f === 'peso') v = peso(v);
      else if (f === 'int') v = fmtInt(v);
      el.textContent = v == null ? '' : v;
    });
    $$('[data-show-if]').forEach(function (el) {
      el.hidden = !get(cfg, el.getAttribute('data-show-if'));
    });
    renderPhotos();
    renderTiers();
    renderLateTable();
    renderComparison();
    renderHeroFrom();
  }

  function renderPhotos() {
    var photos = (cfg.bike.photos || []).filter(Boolean);
    var box = $('#hero-photo');
    var thumbs = $('#hero-thumbs');
    if (!photos.length) return;
    function show(i) {
      box.innerHTML = '<img src="' + esc(photos[i]) + '" alt="' + esc(cfg.bike.year + ' ' + cfg.bike.name + ' photo ' + (i + 1)) + '">';
      $$('button', thumbs).forEach(function (b, j) { b.classList.toggle('active', i === j); });
    }
    if (photos.length > 1) {
      thumbs.hidden = false;
      thumbs.innerHTML = photos.map(function (src, i) {
        return '<button type="button" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(src) + '" alt=""></button>';
      }).join('');
      $$('button', thumbs).forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); });
    }
    show(0);
  }

  function renderTiers() {
    var rows = cfg.premiumTiers.slice().sort(function (a, b) { return a.fromMonth - b.fromMonth; })
      .filter(function (t) { return t.fromMonth <= cfg.maxTermMonths; })
      .map(function (t) {
        var to = Math.min(t.toMonth, cfg.maxTermMonths);
        var range = t.fromMonth === to ? monthsLabel(to) : t.fromMonth + '–' + to + ' months';
        var cost = Math.round(10000 * t.monthlyRatePct / 100);
        return '<tr><td>' + range + '</td><td><strong>' + pct(t.monthlyRatePct) + '</strong></td><td>' +
          peso(cost) + ' per month</td></tr>';
      });
    $('#tier-table tbody').innerHTML = rows.join('');
    $('#rules-list').innerHTML = [
      'Minimum down payment: <strong>' + peso(cfg.minDownPayment) + '</strong>',
      'Minimum monthly payment: <strong>' + peso(cfg.minMonthlyPayment) + '</strong>',
      'Longest plan: <strong>' + monthsLabel(cfg.maxTermMonths) + '</strong>',
      'Early pay-off: <strong>no penalty</strong>, unused financing charge waived',
    ].map(function (s) { return '<li>' + s + '</li>'; }).join('');

    var ex = P.buildPlan(cfg, {
      mode: 'monthly',
      downPayment: cfg.defaults.downPayment,
      monthlyPayment: cfg.defaults.monthlyPayment,
      handoverDate: todayManila(),
    }).plan;
    if (ex && ex.months) {
      $('#example-line').textContent = peso(ex.downPayment) + ' down leaves ' + peso(ex.financed) + ' to finance. At ' +
        peso(ex.monthlyPayment) + ' a month that takes ' + monthsLabel(ex.months) + ', so the rate is ' +
        pct(ex.monthlyRatePct) + ' × ' + ex.months + ' = ' + pct(ex.monthlyRatePct * ex.months) + ' of ' +
        peso(ex.financed) + ', or ' + peso(ex.premium) + '. Total: ' + peso(ex.totalInstallmentPrice) + '.';
    }
  }

  function renderLateTable() {
    var lf = cfg.lateFees;
    var dr = cfg.defaultRules;
    var rows = [];
    if (lf.graceDays > 0) rows.push(['1–' + lf.graceDays + ' days late', 'Grace period — no fee']);
    var cumulative = 0;
    lf.fees.forEach(function (f, i) {
      cumulative += f.amount;
      rows.push([
        f.fromDay + '–' + f.toDay + ' days late',
        (i === 0 ? '' : 'Additional ') + peso(f.amount) + ' late fee' + (i === 0 ? '' : ' (' + peso(cumulative) + ' total)'),
      ]);
    });
    rows.push(['More than ' + lf.writtenNoticeAfterDays + ' days late', 'Written notice']);
    rows.push([dr.formalNoticeAfterConsecutiveMissed + ' consecutive missed payments',
      'Formal default notice, with ' + dr.cureDays + ' days to catch up']);
    rows.push([dr.remediesAfterMissed + ' missed payments (and not caught up)',
      'Seller may pursue the remedies allowed by law and the agreement']);
    $('#late-table tbody').innerHTML = rows.map(function (r) {
      return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
    }).join('');
    $('#late-cap').textContent = peso(cumulative);
  }

  function renderComparison() {
    var down = cfg.defaults.downPayment;
    $('#compare-down').textContent = peso(down);
    var dealer = P.dealerTotals(cfg);
    var rows = dealer.map(function (d) {
      var ours = d.months <= cfg.maxTermMonths
        ? P.buildPlan(cfg, { mode: 'term', downPayment: down, termMonths: d.months, handoverDate: todayManila() }).plan
        : null;
      var oursCells = ours
        ? '<td class="hl">' + peso(ours.monthlyPayment) + '</td><td class="hl">' + peso(ours.totalInstallmentPrice) +
          '</td><td class="hl"><strong>' + peso(ours.premium) + '</strong></td>'
        : '<td class="hl muted" colspan="3">Not offered (max ' + monthsLabel(cfg.maxTermMonths) + ')</td>';
      return '<tr><th scope="row">' + d.months + ' months</th><td>' + peso(d.netMonthly) + '</td><td>' + peso(d.total) +
        '</td><td>' + peso(d.premium) + '</td>' + oursCells + '</tr>';
    });
    $('#compare-table tbody').innerHTML = rows.join('');

    var longest = dealer.filter(function (d) { return d.months <= cfg.maxTermMonths; }).pop();
    if (longest) {
      var ours = P.buildPlan(cfg, { mode: 'term', downPayment: down, termMonths: longest.months, handoverDate: todayManila() }).plan;
      if (ours && longest.effectiveAnnualRatePct > 0) {
        var ratio = ours.effectiveAnnualRatePct / longest.effectiveAnnualRatePct;
        $('#why-rate-compare').textContent = ratio < 0.4 ? 'a third' : ratio < 0.6 ? 'half' : 'less than';
      }
    }
  }

  function renderHeroFrom() {
    var financed = cfg.cashPrice - cfg.minDownPayment;
    var p = P.priceForTerm(cfg, financed, cfg.maxTermMonths, false);
    if (!p) return;
    var m = Math.max(cfg.minMonthlyPayment, P.ceilTo(p.totalOfMonthly / cfg.maxTermMonths, cfg.monthlyRoundTo));
    $('#hero-from-monthly').textContent = peso(m);
  }

  // ---------- inputs ----------

  function setupInputs() {
    var maxDown = cfg.cashPrice;
    var rngDown = $('#rng-down');
    rngDown.min = Math.min(cfg.minDownPayment, 5000);
    rngDown.max = Math.min(maxDown, Math.max(40000, cfg.minDownPayment * 4));
    var rngMonthly = $('#rng-monthly');
    rngMonthly.min = Math.min(cfg.minMonthlyPayment, 1000);
    rngMonthly.max = 15000;
    var rngTerm = $('#rng-term');
    rngTerm.min = cfg.minTermMonths;
    rngTerm.max = cfg.maxTermMonths;
    $('#in-term').min = cfg.minTermMonths;
    $('#in-term').max = cfg.maxTermMonths;

    chips('#chips-down', uniq([cfg.minDownPayment, 15000, 20000, 30000]).filter(function (v) {
      return v >= cfg.minDownPayment && v < cfg.cashPrice;
    }).concat([cfg.cashPrice]), function (v) {
      return v === cfg.cashPrice ? 'Pay in full' : peso(v);
    }, 'downPayment');
    chips('#chips-monthly', [2500, 3000, 3500, 4000, 5000], peso, 'monthlyPayment');
    chips('#chips-term', [6, 12, 18, 24].filter(function (n) { return n <= cfg.maxTermMonths; }), function (n) {
      return n + ' mo';
    }, 'termMonths');

    moneyField('#in-down', '#rng-down', 'downPayment');
    moneyField('#in-monthly', '#rng-monthly', 'monthlyPayment');

    var inTerm = $('#in-term');
    inTerm.addEventListener('input', function () {
      state.termMonths = inTerm.value === '' ? NaN : Number(inTerm.value);
      if (isFinite(state.termMonths)) rngTerm.value = state.termMonths;
      update();
    });
    rngTerm.addEventListener('input', function () {
      state.termMonths = Number(rngTerm.value);
      inTerm.value = state.termMonths;
      update();
    });

    var inDate = $('#in-handover');
    inDate.min = todayManila();
    inDate.addEventListener('input', function () {
      state.handoverDate = inDate.value || todayManila();
      update();
    });

    $$('.mode-toggle button').forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode');
        if (mode === state.mode) return;
        // Carry the current plan across so switching modes doesn't jump to unrelated numbers.
        var p = lastResult && lastResult.plan;
        if (mode === 'term' && p && p.months) state.termMonths = Math.min(cfg.maxTermMonths, p.months);
        if (mode === 'monthly' && p && p.monthlyPayment) state.monthlyPayment = p.monthlyPayment;
        state.mode = mode;
        syncInputs();
        update();
      });
    });
  }

  function uniq(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }

  function chips(sel, values, label, key) {
    var box = $(sel);
    box.innerHTML = values.map(function (v) {
      return '<button type="button" class="chip" data-v="' + v + '">' + esc(label(v)) + '</button>';
    }).join('');
    $$('button', box).forEach(function (b) {
      b.addEventListener('click', function () {
        state[key] = Number(b.getAttribute('data-v'));
        syncInputs();
        update();
      });
    });
  }

  function moneyField(inputSel, rangeSel, key) {
    var input = $(inputSel);
    var range = $(rangeSel);
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^\d]/g, '');
      state[key] = raw === '' ? NaN : Number(raw);
      // Keep thousands separators while typing without jumping the caret to the end unnecessarily.
      var pos = input.selectionStart;
      var before = input.value.length;
      input.value = raw === '' ? '' : fmtInt(Number(raw));
      var delta = input.value.length - before;
      try { input.setSelectionRange(Math.max(0, pos + delta), Math.max(0, pos + delta)); } catch (_) {}
      if (isFinite(state[key])) range.value = state[key];
      update();
    });
    range.addEventListener('input', function () {
      state[key] = Number(range.value);
      input.value = fmtInt(state[key]);
      update();
    });
  }

  function syncInputs() {
    $('#in-down').value = isFinite(state.downPayment) ? fmtInt(state.downPayment) : '';
    $('#rng-down').value = state.downPayment || 0;
    $('#in-monthly').value = isFinite(state.monthlyPayment) ? fmtInt(state.monthlyPayment) : '';
    $('#rng-monthly').value = state.monthlyPayment || 0;
    $('#in-term').value = isFinite(state.termMonths) ? state.termMonths : '';
    $('#rng-term').value = state.termMonths || cfg.minTermMonths;
    $('#in-handover').value = state.handoverDate;
    $$('.mode-toggle button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-mode') === state.mode));
    });
    $('#field-monthly').hidden = state.mode !== 'monthly';
    $('#field-term').hidden = state.mode !== 'term';
  }

  // ---------- results ----------

  function update() {
    var r = P.buildPlan(cfg, state);
    lastResult = r;
    var p = r.plan;
    var ok = r.withinTerms;

    var pill = $('#status-pill');
    pill.className = 'status-pill ' + (ok ? 'ok' : 'warn');
    pill.textContent = ok
      ? (r.status === 'cash' ? 'Full cash purchase' : 'Within approved terms')
      : 'Outside approved terms';
    var badge = $('#summary-badge');
    badge.className = 'summary-badge ' + (ok ? 'ok' : 'warn');
    badge.textContent = pill.textContent;

    $$('.field').forEach(function (f) { f.classList.remove('has-issue'); });
    r.issues.forEach(function (i) {
      var f = document.querySelector('.field[data-field="' + i.field + '"]');
      if (f) f.classList.add('has-issue');
    });

    var issuesBox = $('#issues');
    issuesBox.hidden = !r.issues.length;
    $('#issue-list').innerHTML = r.issues.map(function (i) { return '<li>' + esc(i.message) + '</li>'; }).join('');
    $('#suggestions').innerHTML = r.suggestions.length
      ? '<span class="sugg-label">Try instead:</span>' + r.suggestions.map(function (s, idx) {
          return '<button type="button" class="chip chip-sugg" data-idx="' + idx + '">' + esc(s.label) + '</button>';
        }).join('')
      : '';
    $$('#suggestions button').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = r.suggestions[Number(b.getAttribute('data-idx'))];
        Object.keys(s.patch).forEach(function (k) { state[k] = s.patch[k]; });
        syncInputs();
        update();
      });
    });
    var notes = $('#notes');
    notes.hidden = !r.notes.length;
    notes.textContent = r.notes.join(' ');

    var dueHint = $('#hint-due');
    if (p && p.firstDueDate) {
      dueHint.textContent = 'First monthly payment due ' + fmtDate(p.firstDueDate, true) +
        (Number(cfg.dueDay) ? ', then every ' + ordinal(cfg.dueDay) + ' of the month.' : ', then the same day each month.');
    } else {
      dueHint.textContent = '';
    }

    var hint = $('#hint-monthly');
    var financedForHint = cfg.cashPrice - Math.max(isFinite(state.downPayment) ? state.downPayment : 0, cfg.minDownPayment);
    var pMax = P.priceForTerm(cfg, Math.max(0, financedForHint), cfg.maxTermMonths, false);
    if (pMax && financedForHint > 0) {
      var minM = Math.max(cfg.minMonthlyPayment, P.ceilTo(pMax.totalOfMonthly / cfg.maxTermMonths, cfg.monthlyRoundTo));
      hint.textContent = 'With this down payment, the lowest monthly that fits within ' + monthsLabel(cfg.maxTermMonths) +
        ' is about ' + peso(minM) + '.';
    } else {
      hint.textContent = 'Minimum ' + peso(cfg.minMonthlyPayment) + '.';
    }

    renderResults(r);
    renderSchedule(r);
    renderRecap(r);
    markChips();
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function setText(sel, v) {
    $(sel).textContent = v;
  }

  function renderResults(r) {
    var p = r.plan;
    if (!p) {
      ['#r-monthly', '#r-months', '#r-total', '#d-down', '#d-monthly', '#d-count', '#d-final', '#d-remaining', '#d-rate',
        '#d-premium', '#d-total', '#d-first', '#d-last', '#s-down', '#s-monthly', '#s-months', '#s-total', '#s-premium',
        '#s-last'].forEach(function (s) { setText(s, '—'); });
      ['#r-monthly-sub', '#r-months-sub', '#r-total-sub'].forEach(function (s) { setText(s, ''); });
      return;
    }
    var cash = r.status === 'cash';
    var hasFinal = p.months > 1 && p.finalPayment !== p.monthlyPayment;

    setText('#r-monthly', cash ? '₱0' : peso(p.monthlyPayment));
    setText('#r-monthly-sub', cash ? 'Paid in full' : hasFinal ? 'Last payment ' + peso(p.finalPayment) : 'Every month');
    setText('#r-months', cash ? '—' : monthsLabel(p.months));
    setText('#r-months-sub', cash ? '' : 'Until ' + fmtDate(p.finalDueDate));
    setText('#r-total', peso(p.totalInstallmentPrice));
    setText('#r-total-sub', cash ? 'Cash price' : peso(p.premium) + ' over the cash price');

    setText('#d-down', peso(p.downPayment));
    setText('#d-monthly', cash ? '—' : peso(p.monthlyPayment));
    setText('#d-count', cash ? '—' : String(p.months));
    setText('#d-final', cash ? '—' : hasFinal ? peso(p.finalPayment) + ' (month ' + p.months + ')' : 'Same as monthly');
    setText('#d-remaining', peso(p.totalOfMonthly));
    setText('#d-rate', cash ? '—' : pct(p.monthlyRatePct) + ' per month × ' + p.months);
    setText('#d-premium', peso(p.premium));
    setText('#d-total', peso(p.totalInstallmentPrice));
    setText('#d-first', fmtDate(p.firstDueDate, true));
    setText('#d-last', fmtDate(p.finalDueDate, true));

    setText('#s-down', peso(p.downPayment));
    setText('#s-monthly', cash ? '—' : peso(p.monthlyPayment) + (hasFinal ? ' (last ' + peso(p.finalPayment) + ')' : ''));
    setText('#s-months', cash ? 'Paid in full' : monthsLabel(p.months));
    setText('#s-total', peso(p.totalInstallmentPrice));
    setText('#s-premium', peso(p.premium));
    setText('#s-last', cash ? fmtDate(p.handoverDate, true) : fmtDate(p.finalDueDate, true));
  }

  function renderSchedule(r) {
    var p = r.plan;
    var tbody = $('#schedule-table tbody');
    var tfoot = $('#schedule-table tfoot');
    if (!p) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Enter a valid down payment and monthly amount to see your schedule.</td></tr>';
      tfoot.innerHTML = '';
      return;
    }
    var rows = ['<tr class="row-down"><td>Down payment</td><td>' + fmtDate(p.handoverDate) + ' <small>(handover)</small></td><td class="num">' +
      peso(p.downPayment) + '</td><td class="num">' + peso(p.totalOfMonthly) + '</td><td class="num col-payoff">' +
      peso(p.financed) + '</td></tr>'];
    p.schedule.forEach(function (s) {
      var last = s.number === p.months;
      rows.push('<tr' + (last ? ' class="row-last"' : '') + '><td>Month ' + s.number + '</td><td>' + fmtDate(s.dueDate) +
        '</td><td class="num">' + peso(s.amount) + '</td><td class="num">' + peso(s.remainingBalance) +
        '</td><td class="num col-payoff">' + peso(s.payoffAfter) + '</td></tr>');
    });
    tbody.innerHTML = rows.join('');
    tfoot.innerHTML = '<tr><td colspan="2">Total paid</td><td class="num">' + peso(p.totalInstallmentPrice) +
      '</td><td colspan="2" class="muted small">Cash price ' + peso(p.cashPrice) + ' + financing ' + peso(p.premium) + '</td></tr>';
  }

  function renderRecap(r) {
    var p = r.plan;
    var box = $('#submit-recap');
    if (!p) {
      box.innerHTML = '<p class="muted">Set up a plan in the calculator first.</p>';
      return;
    }
    var cash = r.status === 'cash';
    box.innerHTML =
      '<div><span>Down</span><strong>' + peso(p.downPayment) + '</strong></div>' +
      '<div><span>Monthly</span><strong>' + (cash ? '—' : peso(p.monthlyPayment)) + '</strong></div>' +
      '<div><span>Duration</span><strong>' + (cash ? 'Cash' : monthsLabel(p.months)) + '</strong></div>' +
      '<div><span>Total</span><strong>' + peso(p.totalInstallmentPrice) + '</strong></div>' +
      (r.withinTerms ? '' : '<p class="recap-warn">This plan is outside the approved terms. You can still send it, but the seller is more likely to approve a plan within the terms.</p>');
  }

  function markChips() {
    $$('#chips-down .chip').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.v) === state.downPayment); });
    $$('#chips-monthly .chip').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.v) === state.monthlyPayment); });
    $$('#chips-term .chip').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.v) === state.termMonths); });
  }

  // ---------- submit ----------

  function setupSubmit() {
    var form = $('#submit-form');
    var err = $('#submit-error');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var name = $('#buyer-name').value.trim();
      var contact = $('#buyer-contact').value.trim();
      var problems = [];
      if (!lastResult || !lastResult.plan) problems.push('Set up a valid plan in the calculator first.');
      if (!name) problems.push('Enter your full name.');
      if (!contact) problems.push('Enter a mobile number or Messenger name.');
      if (!$('#ack-box').checked) problems.push('Tick the acknowledgment box.');
      if (problems.length) {
        err.textContent = problems.join(' ');
        err.hidden = false;
        return;
      }
      var btn = $('#btn-submit');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      fetch('/api/fazzio/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer: { name: name, contact: contact, message: $('#buyer-message').value },
          acknowledged: true,
          input: {
            mode: state.mode,
            downPayment: state.downPayment,
            monthlyPayment: state.monthlyPayment,
            termMonths: state.termMonths,
            handoverDate: state.handoverDate,
          },
        }),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok) throw new Error(data.error || 'Could not send the proposal (error ' + res.status + ').');
            return data;
          });
        })
        .then(function (data) {
          submitted = data;
          $('#success-ref').textContent = data.reference;
          if (!data.withinTerms) {
            $('#success-note').textContent = 'Your plan is outside the standard terms, so the seller may suggest an adjustment. Nothing is final until you both sign the written agreement.';
          }
          $('#submit-card').hidden = true;
          $('#success-card').hidden = false;
          $('#print-meta').textContent = 'Reference ' + data.reference + ' · Submitted ' +
            new Date(data.submittedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
          $('#success-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .catch(function (e2) {
          err.textContent = e2.message === 'Failed to fetch'
            ? 'Couldn’t reach the server. Check your connection, or save a PDF and send it to the seller directly.'
            : e2.message;
          err.hidden = false;
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Submit My Preferred Plan';
        });
    });

    $('#btn-new-plan').addEventListener('click', function () {
      $('#success-card').hidden = true;
      $('#submit-card').hidden = false;
      $('#ack-box').checked = false;
      submitted = null;
      document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
    });
  }

  function setupPrint() {
    $$('[data-print]').forEach(function (b) {
      b.addEventListener('click', function () { window.print(); });
    });
    var opened = [];
    window.addEventListener('beforeprint', function () {
      if (!submitted) {
        $('#print-meta').textContent = 'Draft prepared ' +
          new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) +
          ' · Not yet submitted';
      }
      opened = $$('details:not([open])');
      opened.forEach(function (d) { d.open = true; });
    });
    window.addEventListener('afterprint', function () {
      opened.forEach(function (d) { d.open = false; });
    });
  }

  // ---------- boot ----------

  function boot(loaded) {
    if (loaded) cfg = P.mergeConfig(loaded);
    state.downPayment = cfg.defaults.downPayment;
    state.monthlyPayment = cfg.defaults.monthlyPayment;
    state.termMonths = cfg.defaults.termMonths;
    state.handoverDate = todayManila();
    bindConfig();
    setupInputs();
    syncInputs();
    update();
  }

  setupSubmit();
  setupPrint();
  fetch('/api/fazzio/config', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(boot);
})();
