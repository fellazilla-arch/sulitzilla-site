(function () {
  'use strict';

  var P = window.FazzioPricing;
  var peso = P.peso;
  var KEY_STORE = 'fazzioAdminKey';
  var key = sessionStorage.getItem(KEY_STORE) || '';
  var ledger = null;
  var saveTimer = null;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(v) {
    var n = Number(String(v == null ? '' : v).replace(/[^\d.]/g, ''));
    return isFinite(n) ? Math.round(n) : 0;
  }

  function fmtMoneyInput(n) {
    return n ? Number(n).toLocaleString('en-PH') : '';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('en-PH', { timeZone: 'UTC', dateStyle: 'medium' });
  }

  // ---------- server ----------

  function api(method, body) {
    return fetch('/api/fazzio/ledger', {
      method: method,
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.status === 401) {
          logout();
          throw new Error((data && data.error) || 'Wrong password.');
        }
        if (!res.ok) throw new Error((data && data.error) || 'Request failed (' + res.status + ').');
        return data;
      });
    });
  }

  function setSaveState(text, cls) {
    var el = $('#save-state');
    el.textContent = text;
    el.className = 'save-state ' + (cls || '');
  }

  function queueSave() {
    setSaveState('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      api('PUT', ledger)
        .then(function () { setSaveState('Saved', 'ok'); })
        .catch(function (err) { setSaveState('Not saved: ' + err.message, 'bad'); });
    }, 600);
  }

  window.addEventListener('beforeunload', function (e) {
    if (saveTimer && $('#save-state').textContent === 'Saving…') {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ---------- login ----------

  function logout() {
    sessionStorage.removeItem(KEY_STORE);
    key = '';
    $('#login').hidden = false;
    $('#setup').hidden = true;
    $('#tracker').hidden = true;
    $('#btn-logout').hidden = true;
  }

  function open() {
    return api('GET').then(function (data) {
      sessionStorage.setItem(KEY_STORE, key);
      $('#login').hidden = true;
      $('#btn-logout').hidden = false;
      ledger = data;
      if (ledger && ledger.rows) showTracker();
      else showSetup(false);
    });
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    key = $('#login-key').value.trim();
    $('#login-error').hidden = true;
    open().catch(function (err) {
      $('#login-error').textContent = err.message;
      $('#login-error').hidden = false;
    });
  });
  $('#btn-logout').addEventListener('click', logout);

  // ---------- setup ----------

  var dueSel = $('#s-dueday');
  dueSel.innerHTML = '<option value="0">Same day of the month as handover</option>' +
    Array.from({ length: 28 }, function (_, i) { return '<option value="' + (i + 1) + '">Day ' + (i + 1) + ' of each month</option>'; }).join('');

  function showSetup(editing) {
    $('#setup').hidden = false;
    $('#tracker').hidden = true;
    $('#setup-title').textContent = editing ? 'Edit the agreed plan' : 'Set up the agreed plan';
    $('#btn-cancel-setup').hidden = !editing;
    $('#setup-warning').hidden = !editing;
    $('#btn-create').textContent = editing ? 'Recreate schedule' : 'Create schedule';
    var src = editing && ledger ? ledger : null;
    $('#s-name').value = src ? src.buyerName || '' : '';
    $('#s-down').value = fmtMoneyInput(src ? src.downPayment : P.CONFIG.defaults.downPayment);
    $('#s-monthly').value = fmtMoneyInput(src ? src.monthlyPayment : P.CONFIG.defaults.monthlyPayment);
    $('#s-handover').value = src ? src.handoverDate : P.todayManila();
    dueSel.value = String(src ? src.dueDay || 0 : 0);
    setupPreview();
  }

  function setupPreview() {
    var r = P.calculate(money($('#s-down').value), money($('#s-monthly').value));
    var out = $('#setup-preview');
    var p = r.plan;
    if (!p || p.cash) {
      out.className = 'setup-preview bad';
      out.textContent = p && p.cash ? 'That’s a full cash payment, so there’s nothing to track.' : r.problems.join(' ');
      $('#btn-create').disabled = true;
      return;
    }
    $('#btn-create').disabled = false;
    var dates = P.dueDates($('#s-handover').value, Number(dueSel.value), p.months);
    out.className = 'setup-preview' + (r.ok ? '' : ' warn');
    out.textContent = p.months + ' monthly payments of ' + peso(p.monthlyPayment) +
      (p.finalPayment !== p.monthlyPayment ? ' (last one ' + peso(p.finalPayment) + ')' : '') +
      ' · ' + p.yearlyRatePct.toFixed(1) + '% a year · total ' + peso(p.total) +
      (dates.length ? ' · first due ' + fmtDate(dates[0]) + ', last due ' + fmtDate(dates[dates.length - 1]) : '') +
      (r.ok ? '' : ' · Note: ' + r.problems.join(' '));
  }

  ['#s-down', '#s-monthly'].forEach(function (s) {
    $(s).addEventListener('input', function () {
      var raw = this.value.replace(/[^\d]/g, '');
      this.value = raw ? Number(raw).toLocaleString('en-PH') : '';
      setupPreview();
    });
  });
  $('#s-handover').addEventListener('input', setupPreview);
  dueSel.addEventListener('change', setupPreview);
  $('#btn-cancel-setup').addEventListener('click', showTracker);

  $('#btn-create').addEventListener('click', function () {
    var down = money($('#s-down').value);
    var r = P.calculate(down, money($('#s-monthly').value));
    var p = r.plan;
    if (!p || p.cash) return;
    var handover = $('#s-handover').value || P.todayManila();
    var dueDay = Number(dueSel.value);
    if (ledger && ledger.rows && !confirm('Recreate the schedule? Recorded payments are kept by payment number.')) return;
    var old = ledger && ledger.rows ? ledger.rows : [];
    var dates = P.dueDates(handover, dueDay, p.months);
    var rows = p.schedule.map(function (s, i) {
      var prev = old[i] || {};
      return {
        number: s.number,
        dueDate: dates[i],
        amountDue: s.amount,
        paidAmount: prev.paidAmount || 0,
        paidDate: prev.paidDate || '',
        daysLateOverride: prev.daysLateOverride == null ? null : prev.daysLateOverride,
        penaltyWaived: !!prev.penaltyWaived,
        penaltyPaid: !!prev.penaltyPaid,
        note: prev.note || '',
      };
    });
    var lostRecords = old.slice(rows.length).filter(function (x) { return x.paidAmount || x.note; }).length;
    if (lostRecords && !confirm(lostRecords + ' recorded payment row(s) beyond the new plan length will be removed. Continue?')) return;
    ledger = {
      buyerName: $('#s-name').value.trim(),
      downPayment: down,
      monthlyPayment: p.monthlyPayment,
      handoverDate: handover,
      dueDay: dueDay,
      borrowed: p.borrowed,
      interest: p.interest,
      months: p.months,
      monthlyRatePct: p.monthlyRatePct,
      total: p.total,
      down: ledger && ledger.down ? ledger.down : { paidAmount: down, paidDate: handover },
      rows: rows,
      createdAt: (ledger && ledger.createdAt) || new Date().toISOString(),
    };
    queueSave();
    showTracker();
  });

  // ---------- tracker ----------

  function showTracker() {
    $('#setup').hidden = true;
    $('#tracker').hidden = false;
    $('#t-title').textContent = ledger.buyerName ? ledger.buyerName + '’s payments' : 'Payments';
    $('#t-plan').textContent = peso(ledger.downPayment) + ' down, then ' + ledger.rows.length + ' monthly payments of ' +
      peso(ledger.monthlyPayment) + ' · ' + (ledger.monthlyRatePct * 12).toFixed(1) + '% a year · handover ' +
      fmtDate(ledger.handoverDate);
    $('#rule-list').innerHTML = P.lateRuleLines().map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    renderTable();
    refresh();
  }

  function rowHtml(r, i) {
    return '<tr data-i="' + i + '">' +
      '<td class="num-col">' + r.number + '</td>' +
      '<td><input type="date" data-k="dueDate" value="' + esc(r.dueDate) + '"></td>' +
      '<td><input type="text" inputmode="numeric" class="m" data-k="amountDue" value="' + fmtMoneyInput(r.amountDue) + '"></td>' +
      '<td><input type="text" inputmode="numeric" class="m" data-k="paidAmount" value="' + fmtMoneyInput(r.paidAmount) + '" placeholder="0"></td>' +
      '<td><input type="date" data-k="paidDate" value="' + esc(r.paidDate) + '"></td>' +
      '<td><span class="badge" data-out="status"></span></td>' +
      '<td><input type="number" min="0" step="1" class="days" data-k="daysLateOverride" value="' +
        (r.daysLateOverride == null ? '' : esc(r.daysLateOverride)) + '"></td>' +
      '<td class="fee"><strong data-out="fee"></strong>' +
        '<label><input type="checkbox" data-k="penaltyWaived"' + (r.penaltyWaived ? ' checked' : '') + '> waive</label>' +
        '<label><input type="checkbox" data-k="penaltyPaid"' + (r.penaltyPaid ? ' checked' : '') + '> paid</label></td>' +
      '<td><input type="text" class="note" data-k="note" value="' + esc(r.note) + '" placeholder="Note"></td>' +
      '<td><button type="button" class="btn btn-sm" data-act="paid-today">Paid today</button></td>' +
      '</tr>';
  }

  function renderTable() {
    var d = ledger.down || { paidAmount: 0, paidDate: '' };
    var downRow = '<tr class="down-row" data-i="down">' +
      '<td class="num-col">Down</td><td>' + fmtDate(ledger.handoverDate) + '</td>' +
      '<td>' + peso(ledger.downPayment) + '</td>' +
      '<td><input type="text" inputmode="numeric" class="m" data-k="paidAmount" value="' + fmtMoneyInput(d.paidAmount) + '" placeholder="0"></td>' +
      '<td><input type="date" data-k="paidDate" value="' + esc(d.paidDate) + '"></td>' +
      '<td><span class="badge" data-out="status"></span></td><td></td><td></td><td></td><td></td></tr>';
    $('#ledger tbody').innerHTML = downRow + ledger.rows.map(rowHtml).join('');
  }

  function onEdit(e) {
    var input = e.target;
    var k = input.dataset.k;
    if (!k) return;
    var tr = input.closest('tr');
    var target = tr.dataset.i === 'down' ? (ledger.down = ledger.down || {}) : ledger.rows[Number(tr.dataset.i)];
    if (input.type === 'checkbox') target[k] = input.checked;
    else if (input.classList.contains('m')) {
      var raw = input.value.replace(/[^\d]/g, '');
      target[k] = raw ? Number(raw) : 0;
      if (e.type === 'change') input.value = fmtMoneyInput(target[k]);
    } else if (k === 'daysLateOverride') target[k] = input.value === '' ? null : Math.max(0, Number(input.value));
    else target[k] = input.value;
    refresh();
    queueSave();
  }

  $('#ledger').addEventListener('input', onEdit);
  $('#ledger').addEventListener('change', onEdit);

  $('#ledger').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="paid-today"]');
    if (!b) return;
    var tr = b.closest('tr');
    var r = ledger.rows[Number(tr.dataset.i)];
    r.paidAmount = r.amountDue;
    r.paidDate = P.todayManila();
    $('[data-k="paidAmount"]', tr).value = fmtMoneyInput(r.paidAmount);
    $('[data-k="paidDate"]', tr).value = r.paidDate;
    refresh();
    queueSave();
  });

  $('#btn-add-row').addEventListener('click', function () {
    var last = ledger.rows[ledger.rows.length - 1];
    var nextDue = last ? P.dueDates(last.dueDate, 0, 1)[0] : P.dueDates(ledger.handoverDate, ledger.dueDay, 1)[0];
    ledger.rows.push({ number: ledger.rows.length + 1, dueDate: nextDue, amountDue: 0, paidAmount: 0, paidDate: '',
      daysLateOverride: null, penaltyWaived: false, penaltyPaid: false, note: '' });
    renderTable();
    refresh();
    queueSave();
  });

  $('#btn-edit-plan').addEventListener('click', function () { showSetup(true); });
  $('#btn-print').addEventListener('click', function () { window.print(); });

  function refresh() {
    var today = P.todayManila();
    var waived = 0;
    ledger.rows.forEach(function (r, i) {
      var tr = $('#ledger tbody tr[data-i="' + i + '"]');
      if (!tr) return;
      var s = P.rowStatus(r, today);
      var badge = $('[data-out="status"]', tr);
      badge.textContent = s.label;
      badge.className = 'badge ' + s.key;
      tr.className = 'st-' + s.key;
      var days = $('[data-k="daysLateOverride"]', tr);
      days.placeholder = String(s.autoDaysLate);
      days.classList.toggle('overridden', r.daysLateOverride != null);
      var fee = $('[data-out="fee"]', tr);
      fee.textContent = s.penaltyBeforeWaiver ? peso(s.penaltyBeforeWaiver) : '—';
      fee.className = r.penaltyWaived && s.penaltyBeforeWaiver ? 'waived' : '';
      if (r.penaltyWaived) waived += s.penaltyBeforeWaiver;
      $('[data-act="paid-today"]', tr).hidden = s.fullyPaid;
    });

    var d = ledger.down || {};
    var downPaid = Number(d.paidAmount) || 0;
    var downShort = Math.max(0, ledger.downPayment - downPaid);
    var downBadge = $('#ledger tr[data-i="down"] [data-out="status"]');
    downBadge.textContent = downShort ? (downPaid ? 'Partly paid' : 'Not received') : 'Received';
    downBadge.className = 'badge ' + (downShort ? 'late' : 'paid');

    var s = P.ledgerSummary(ledger, today);
    var totalPrice = ledger.downPayment + s.totalDue;
    var left = ledger.rows.filter(function (r) { return !P.rowStatus(r, today).fullyPaid; }).length;
    $('#st-paid').textContent = peso(downPaid + s.totalPaid);
    $('#st-paid-sub').textContent = 'of ' + peso(totalPrice);
    $('#st-balance').textContent = peso(s.balance + downShort);
    $('#st-balance-sub').textContent = left ? left + (left === 1 ? ' payment left' : ' payments left') : 'Fully paid';
    $('#st-fees').textContent = peso(s.penaltiesOwed);
    $('#st-fees-sub').textContent = peso(s.penaltiesPaid) + ' paid' + (waived ? ' · ' + peso(waived) + ' waived' : '');
    if (s.next) {
      $('#st-next').textContent = peso(s.next.status.shortfall);
      $('#st-next-sub').textContent = 'Due ' + fmtDate(s.next.row.dueDate) + ' · ' + s.next.status.label;
    } else {
      $('#st-next').textContent = '—';
      $('#st-next-sub').textContent = 'All payments made';
    }
    $('#st-payoff').textContent = peso(s.payoff + downShort);

    var notice = $('#notice');
    notice.hidden = !s.noticeDue;
    if (s.noticeDue) {
      notice.textContent = s.overdueInARow + ' payments in a row are overdue. Under the late payment rule, send a written notice; ' +
        'he then has ' + P.CONFIG.lateFees.cureDays + ' days to catch up.';
    }
  }

  if (key) open().catch(logout);
})();
