(function () {
  'use strict';

  var P = window.FazzioPricing;
  var peso = P.peso;
  var KEY_STORE = 'fazzioAdminKey';
  var key = sessionStorage.getItem(KEY_STORE) || '';
  var proposals = [];
  var filter = 'all';
  var cfg = null;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('en-PH', { timeZone: 'UTC', dateStyle: 'medium' });
  }

  function fmtStamp(iso) {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  }

  function api(method, path, body) {
    return fetch('/api/fazzio/admin' + path, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) {
          logout();
          throw new Error(data.error || 'Wrong admin key.');
        }
        if (!res.ok) {
          var e = new Error(data.error || 'Request failed (' + res.status + ').');
          e.data = data;
          throw e;
        }
        return data;
      });
    });
  }

  // ---------- auth ----------

  function showApp() {
    $('#login').hidden = true;
    $('#admin-nav').hidden = false;
    showTab(location.hash === '#settings' ? 'settings' : 'proposals');
    loadProposals();
    loadSettings();
  }

  function logout() {
    sessionStorage.removeItem(KEY_STORE);
    key = '';
    $('#login').hidden = false;
    $('#admin-nav').hidden = true;
    $('#tab-proposals').hidden = true;
    $('#tab-settings').hidden = true;
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    key = $('#login-key').value.trim();
    $('#login-error').hidden = true;
    api('GET', '/config')
      .then(function () {
        sessionStorage.setItem(KEY_STORE, key);
        showApp();
      })
      .catch(function (err) {
        $('#login-error').textContent = err.message;
        $('#login-error').hidden = false;
      });
  });

  $('#btn-logout').addEventListener('click', function (e) {
    e.preventDefault();
    logout();
  });

  function showTab(tab) {
    $('#tab-proposals').hidden = tab !== 'proposals';
    $('#tab-settings').hidden = tab !== 'settings';
    $$('#admin-nav [data-tab]').forEach(function (a) { a.classList.toggle('active', a.dataset.tab === tab); });
    history.replaceState(null, '', tab === 'settings' ? '#settings' : '#');
  }

  $$('#admin-nav [data-tab]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showTab(a.dataset.tab);
    });
  });

  // ---------- proposals ----------

  function loadProposals() {
    return api('GET', '/proposals').then(function (list) {
      proposals = list;
      renderProposals();
    }).catch(function (err) {
      $('#proposal-list').innerHTML = '<p class="form-error">' + esc(err.message) + '</p>';
    });
  }

  $('#btn-refresh').addEventListener('click', loadProposals);

  $$('#filters .chip').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.dataset.filter;
      $$('#filters .chip').forEach(function (c) { c.classList.toggle('active', c === b); });
      renderProposals();
    });
  });

  function scheduleTable(plan) {
    var rows = '<tr class="row-down"><td>Down payment</td><td>' + fmtDate(plan.handoverDate) + '</td><td class="num">' +
      peso(plan.downPayment) + '</td><td class="num">' + peso(plan.totalOfMonthly) + '</td><td class="num col-payoff">' +
      peso(plan.financed) + '</td></tr>';
    plan.schedule.forEach(function (s) {
      rows += '<tr><td>Month ' + s.number + '</td><td>' + fmtDate(s.dueDate) + '</td><td class="num">' + peso(s.amount) +
        '</td><td class="num">' + peso(s.remainingBalance) + '</td><td class="num col-payoff">' + peso(s.payoffAfter) + '</td></tr>';
    });
    return '<div class="table-scroll"><table class="schedule"><thead><tr><th>Payment</th><th>Due</th><th class="num">Amount</th>' +
      '<th class="num">Remaining</th><th class="num col-payoff">Pay-off</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderProposals() {
    var pending = proposals.filter(function (p) { return p.status === 'pending'; }).length;
    $('#count-pending').textContent = pending ? String(pending) : '';
    var list = proposals.filter(function (p) { return filter === 'all' || p.status === filter; });
    var box = $('#proposal-list');
    if (!list.length) {
      box.innerHTML = '<div class="empty admin-card">' + (proposals.length ? 'No proposals with this status.' :
        'No proposals yet. When the buyer submits a plan from the buyer page it will appear here.') + '</div>';
      return;
    }
    box.innerHTML = list.map(function (p) {
      var pl = p.plan;
      var cash = !pl.months;
      var hasFinal = pl.months > 1 && pl.finalPayment !== pl.monthlyPayment;
      var statuses = ['pending', 'approved', 'countered', 'declined', 'withdrawn'];
      return '<article class="proposal" data-id="' + esc(p.id) + '">' +
        '<div class="proposal-top"><div>' +
          '<h3>' + esc(p.buyer.name) + '<span class="tag ' + (p.withinTerms ? 'ok' : 'warn') + '">' +
            (p.withinTerms ? 'Within terms' : 'Outside terms') + '</span></h3>' +
          '<div class="proposal-meta">' + esc(p.reference) + ' · ' + fmtStamp(p.submittedAt) + ' · ' + esc(p.buyer.contact) + '</div>' +
        '</div>' +
        '<select class="status-select" data-status="' + esc(p.status) + '">' + statuses.map(function (s) {
          return '<option value="' + s + '"' + (s === p.status ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="p-grid">' +
          '<div><span>Down</span><strong>' + peso(pl.downPayment) + '</strong></div>' +
          '<div><span>Monthly</span><strong>' + (cash ? '—' : peso(pl.monthlyPayment)) + '</strong></div>' +
          '<div><span>Months</span><strong>' + (cash ? 'Cash' : pl.months + (hasFinal ? ' (last ' + peso(pl.finalPayment) + ')' : '')) + '</strong></div>' +
          '<div><span>Total</span><strong>' + peso(pl.totalInstallmentPrice) + '</strong></div>' +
          '<div><span>Premium</span><strong>' + peso(pl.premium) + '</strong></div>' +
          '<div><span>Eff. yearly rate</span><strong>' + (pl.effectiveAnnualRatePct || 0).toFixed(1) + '%</strong></div>' +
        '</div>' +
        (p.issues && p.issues.length ? '<ul class="p-issues">' + p.issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '') +
        (p.buyer.message ? '<div class="p-message">' + esc(p.buyer.message) + '</div>' : '') +
        '<textarea class="p-note" placeholder="Private note (e.g. counter-offer details)">' + esc(p.sellerNote || '') + '</textarea>' +
        '<div class="p-actions">' +
          '<button class="btn btn-ghost btn-sm" data-act="save-note">Save note</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="print">Print</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="delete">Delete</button>' +
        '</div>' +
        (cash ? '' : '<details><summary>Payment schedule · handover ' + fmtDate(pl.handoverDate) + ' · ' +
          (pl.monthlyRatePct) + '%/mo tier</summary>' + scheduleTable(pl) + '</details>') +
        '</article>';
    }).join('');

    $$('.proposal', box).forEach(function (el) {
      var id = el.dataset.id;
      $('.status-select', el).addEventListener('change', function (e) {
        var sel = e.target;
        api('PATCH', '/proposals/' + id, { status: sel.value }).then(function (p) {
          replace(p);
          sel.dataset.status = p.status;
          $('#count-pending').textContent = String(proposals.filter(function (x) { return x.status === 'pending'; }).length || '');
        }).catch(function (err) { alert(err.message); });
      });
      $('[data-act="save-note"]', el).addEventListener('click', function (e) {
        var btn = e.target;
        api('PATCH', '/proposals/' + id, { sellerNote: $('.p-note', el).value }).then(function (p) {
          replace(p);
          btn.textContent = 'Saved ✓';
          setTimeout(function () { btn.textContent = 'Save note'; }, 1500);
        }).catch(function (err) { alert(err.message); });
      });
      $('[data-act="print"]', el).addEventListener('click', function () {
        el.classList.add('printing');
        var d = $('details', el);
        var wasOpen = d && d.open;
        if (d) d.open = true;
        window.print();
        el.classList.remove('printing');
        if (d) d.open = wasOpen;
      });
      $('[data-act="delete"]', el).addEventListener('click', function () {
        if (!confirm('Delete this proposal permanently?')) return;
        api('DELETE', '/proposals/' + id).then(function () {
          proposals = proposals.filter(function (x) { return x.id !== id; });
          renderProposals();
        }).catch(function (err) { alert(err.message); });
      });
    });
  }

  function replace(p) {
    proposals = proposals.map(function (x) { return x.id === p.id ? p : x; });
  }

  // ---------- settings ----------

  function getPath(o, path) {
    return path.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o);
  }

  function setPath(o, path, v) {
    var parts = path.split('.');
    var last = parts.pop();
    var t = parts.reduce(function (a, k) { return (a[k] = a[k] || {}); }, o);
    t[last] = v;
  }

  var dueSel = $('#due-day');
  dueSel.innerHTML = '<option value="0">Same day as handover, every month</option>' +
    Array.from({ length: 28 }, function (_, i) { return '<option value="' + (i + 1) + '">Day ' + (i + 1) + '</option>'; }).join('');

  function loadSettings() {
    return api('GET', '/config').then(function (data) {
      cfg = data.config;
      fillSettings();
    });
  }

  function fillSettings() {
    $$('[data-path]').forEach(function (el) {
      var v = getPath(cfg, el.dataset.path);
      el.value = v == null ? '' : v;
    });
    $('#photos').value = (cfg.bike.photos || []).join('\n');
    $('#dealer-json').value = JSON.stringify(cfg.dealerComparison, null, 2);
    renderTierRows();
    renderFeeRows();
    $('#pv-down').value = cfg.defaults.downPayment;
    $('#pv-monthly').value = cfg.defaults.monthlyPayment;
    preview();
  }

  function renderTierRows() {
    $('#tiers-table tbody').innerHTML = cfg.premiumTiers.map(function (t, i) {
      return '<tr data-i="' + i + '"><td><input type="number" data-k="fromMonth" value="' + t.fromMonth + '" min="1" step="1"></td>' +
        '<td><input type="number" data-k="toMonth" value="' + t.toMonth + '" min="1" step="1"></td>' +
        '<td><input type="number" data-k="monthlyRatePct" value="' + t.monthlyRatePct + '" min="0" max="10" step="0.05"></td>' +
        '<td><button type="button" class="rm" aria-label="Remove tier">×</button></td></tr>';
    }).join('');
  }

  function renderFeeRows() {
    $('#fees-table tbody').innerHTML = cfg.lateFees.fees.map(function (f, i) {
      return '<tr data-i="' + i + '"><td><input type="number" data-k="fromDay" value="' + f.fromDay + '" min="1" step="1"></td>' +
        '<td><input type="number" data-k="toDay" value="' + f.toDay + '" min="1" step="1"></td>' +
        '<td><input type="number" data-k="amount" value="' + f.amount + '" min="0" step="50"></td>' +
        '<td><button type="button" class="rm" aria-label="Remove fee step">×</button></td></tr>';
    }).join('');
  }

  function readRows(sel) {
    return $$(sel + ' tbody tr').map(function (tr) {
      var o = {};
      $$('input', tr).forEach(function (inp) { o[inp.dataset.k] = Number(inp.value); });
      return o;
    });
  }

  /** Collects the form into a config object; throws on malformed JSON. */
  function collect() {
    var out = JSON.parse(JSON.stringify(cfg));
    $$('[data-path]').forEach(function (el) {
      var v = el.value;
      if (el.type === 'number' || el.dataset.type === 'int') v = v === '' ? NaN : Number(v);
      setPath(out, el.dataset.path, v);
    });
    out.premiumTiers = readRows('#tiers-table');
    out.lateFees.fees = readRows('#fees-table');
    out.bike.photos = $('#photos').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    out.dealerComparison = JSON.parse($('#dealer-json').value);
    return out;
  }

  function preview() {
    var out = $('#preview-out');
    var c;
    try {
      c = P.mergeConfig(collect());
    } catch (e) {
      out.innerHTML = '<span class="muted">Dealer quote JSON is invalid: ' + esc(e.message) + '</span>';
      return;
    }
    var errs = P.validateConfig(c);
    if (errs.length) {
      out.innerHTML = '<strong>Fix these before saving:</strong><ul>' + errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
      $('#preview-terms tbody').innerHTML = '';
      return;
    }
    var down = Number($('#pv-down').value);
    var r = P.buildPlan(c, { mode: 'monthly', downPayment: down, monthlyPayment: Number($('#pv-monthly').value) });
    var p = r.plan;
    out.innerHTML = p
      ? '<strong>' + (r.withinTerms ? 'Within terms' : 'Outside terms') + '</strong> · ' + (p.months ? p.months + ' months, ' : '') +
        'total ' + peso(p.totalInstallmentPrice) + ', premium ' + peso(p.premium) +
        (p.months ? ', last payment ' + peso(p.finalPayment) + ', effective ' + p.effectiveAnnualRatePct.toFixed(1) + '%/yr' : '') +
        (r.issues.length ? '<br><span class="muted">' + r.issues.map(function (i) { return esc(i.message); }).join(' ') + '</span>' : '')
      : '<span class="muted">' + r.issues.map(function (i) { return esc(i.message); }).join(' ') + '</span>';

    var terms = [3, 6, 9, 12, 15, 18, 21, 24, 30, 36].filter(function (n) { return n <= c.maxTermMonths; });
    if (terms.indexOf(c.maxTermMonths) < 0) terms.push(c.maxTermMonths);
    $('#preview-terms tbody').innerHTML = terms.map(function (n) {
      var pl = P.buildPlan(c, { mode: 'term', downPayment: Math.max(down, c.minDownPayment), termMonths: n }).plan;
      if (!pl || !pl.months) return '';
      return '<tr><td>' + n + '</td><td>' + peso(pl.monthlyPayment) + '</td><td>' + peso(pl.totalInstallmentPrice) + '</td><td>' +
        peso(pl.premium) + '</td><td>' + pl.effectiveAnnualRatePct.toFixed(1) + '%</td></tr>';
    }).join('');
  }

  $('#tab-settings').addEventListener('input', function () {
    $('#settings-ok').hidden = true;
    preview();
  });

  $('#tiers-table').addEventListener('click', function (e) {
    if (!e.target.classList.contains('rm')) return;
    cfg.premiumTiers = readRows('#tiers-table');
    cfg.premiumTiers.splice(Number(e.target.closest('tr').dataset.i), 1);
    renderTierRows();
    preview();
  });
  $('#add-tier').addEventListener('click', function () {
    cfg.premiumTiers = readRows('#tiers-table');
    var last = cfg.premiumTiers[cfg.premiumTiers.length - 1];
    var from = last ? last.toMonth + 1 : 1;
    cfg.premiumTiers.push({ fromMonth: from, toMonth: from + 5, monthlyRatePct: last ? last.monthlyRatePct : 1 });
    renderTierRows();
    preview();
  });
  $('#fees-table').addEventListener('click', function (e) {
    if (!e.target.classList.contains('rm')) return;
    cfg.lateFees.fees = readRows('#fees-table');
    cfg.lateFees.fees.splice(Number(e.target.closest('tr').dataset.i), 1);
    renderFeeRows();
    preview();
  });
  $('#add-fee').addEventListener('click', function () {
    cfg.lateFees.fees = readRows('#fees-table');
    var last = cfg.lateFees.fees[cfg.lateFees.fees.length - 1];
    var from = last ? last.toDay + 1 : (Number(getPath(cfg, 'lateFees.graceDays')) || 0) + 1;
    cfg.lateFees.fees.push({ fromDay: from, toDay: from + 9, amount: 100 });
    renderFeeRows();
    preview();
  });

  function showSettingsError(msg, list) {
    var el = $('#settings-error');
    el.innerHTML = esc(msg) + (list && list.length ? '<ul>' + list.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '');
    el.hidden = false;
    $('#settings-ok').hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('#btn-save').addEventListener('click', function () {
    $('#settings-error').hidden = true;
    var body;
    try {
      body = collect();
    } catch (e) {
      return showSettingsError('Dealer quote JSON is invalid: ' + e.message);
    }
    api('PUT', '/config', body).then(function (data) {
      cfg = data.config;
      fillSettings();
      $('#settings-ok').hidden = false;
    }).catch(function (err) {
      showSettingsError(err.message, err.data && err.data.errors);
    });
  });

  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('Reset all financing settings to the original defaults?')) return;
    api('DELETE', '/config').then(function (data) {
      cfg = data.config;
      fillSettings();
      $('#settings-ok').hidden = false;
    }).catch(function (err) { showSettingsError(err.message); });
  });

  if (key) {
    api('GET', '/config').then(showApp).catch(function () { logout(); });
  }
})();
