(function () {
  'use strict';

  var P = window.FazzioPricing;
  var peso = P.peso;
  var KEY_STORE = 'fazzioAdminKey';
  var key = sessionStorage.getItem(KEY_STORE) || '';
  var ledger = null;
  var saveTimer = null;

  var $ = function (s, r) { return (r || document).querySelector(s); };
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
    document.dispatchEvent(new CustomEvent('fazzio:logout'));
  }

  function open() {
    return api('GET').then(function (data) {
      sessionStorage.setItem(KEY_STORE, key);
      $('#login').hidden = true;
      $('#btn-logout').hidden = false;
      ledger = data;
      if (ledger && ledger.rows) showTracker();
      else showSetup(false);
      document.dispatchEvent(new CustomEvent('fazzio:login', { detail: { key: key, ledger: ledger } }));
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
    $('#setup-title').textContent = editing ? 'Change the deal' : 'Enter the deal he chose';
    $('#btn-cancel-setup').hidden = !editing;
    $('#setup-warning').hidden = !editing;
    $('#btn-create').textContent = editing ? 'Update months' : 'Start tracking';
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
    if (!r.ok || !p || p.cash) {
      out.className = 'setup-preview bad';
      out.textContent = p && p.cash ? 'That’s a full cash payment, so there’s nothing to track.' : r.problems.join(' ');
      $('#btn-create').disabled = true;
      return;
    }
    $('#btn-create').disabled = false;
    var dates = P.dueDates($('#s-handover').value, Number(dueSel.value), p.months);
    out.className = 'setup-preview';
    out.textContent = p.months + ' monthly payments of ' + peso(p.monthlyPayment) +
      (p.finalPayment !== p.monthlyPayment ? ' (final payment amount ' + peso(p.finalPayment) + ')' : '') +
      ' · ' + p.yearlyRatePct.toFixed(1) + '% a year · total ' + peso(p.total) +
      (dates.length ? ' · first due ' + fmtDate(dates[0]) + ', last due ' + fmtDate(dates[dates.length - 1]) : '');
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
    if (!r.ok || !p || p.cash) return;
    var handover = $('#s-handover').value || P.todayManila();
    var dueDay = Number(dueSel.value);
    if (ledger && ledger.rows && !confirm('Update the months for this deal? Months already marked paid or late stay marked.')) return;
    var old = ledger && ledger.rows ? P.effectiveRows(ledger).rows : [];
    var dates = P.dueDates(handover, dueDay, p.months);
    var rows = p.schedule.map(function (s, i) {
      var row = { number: s.number, dueDate: dates[i], amountDue: s.amount, paidAmount: 0, paidDate: '',
        daysLateOverride: null, penaltyWaived: false, penaltyPaid: false, note: '' };
      if (old[i] && !old[i].covered) {
        applyChoice(row, choiceFor(old[i]), row.amountDue);
        row.penaltyPaid = !!old[i].penaltyPaid && row.daysLateOverride > 0;
      }
      return row;
    });
    var lostRecords = old.slice(rows.length).filter(function (x) { return choiceFor(x) !== 'unpaid'; }).length;
    if (lostRecords && !confirm(lostRecords + ' marked month(s) beyond the new deal’s length will be removed. Continue?')) return;
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
      rows: rows,
      extraPayments: (ledger && ledger.extraPayments) || [],
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

  var LF = P.CONFIG.lateFees;

  /** Dropdown choices: not paid, on time, then one "paid late" choice per late-fee step. */
  function paymentChoices() {
    var total = 0;
    var out = [{ v: 'unpaid', label: 'Not paid yet' }, { v: 'ontime', label: 'Paid on time' }];
    LF.steps.forEach(function (s, i) {
      total += s.amount;
      var next = LF.steps[i + 1];
      var range = next ? (s.afterDays + 1) + '–' + next.afterDays + ' days' : 'over ' + s.afterDays + ' days';
      out.push({ v: 'late-' + i, label: 'Paid late, ' + range + ' (' + peso(total) + ')' });
    });
    return out;
  }

  /** `r` is an effective row (after extra payments). */
  function choiceFor(r) {
    var s = P.rowStatus(r);
    if (!s.fullyPaid) return 'unpaid';
    var tier = -1;
    LF.steps.forEach(function (step, i) { if (s.daysLate > step.afterDays) tier = i; });
    return tier < 0 ? 'ontime' : 'late-' + tier;
  }

  /** `due` is what this month still needs after extra payments. */
  function applyChoice(r, v, due) {
    r.penaltyWaived = false;
    if (v === 'unpaid') {
      r.paidAmount = 0;
      r.paidDate = '';
      r.daysLateOverride = null;
      r.penaltyPaid = false;
    } else {
      r.paidAmount = due;
      r.paidDate = r.paidDate || P.todayManila();
      r.daysLateOverride = v === 'ontime' ? 0 : LF.steps[Number(v.split('-')[1])].afterDays + 1;
      if (v === 'ontime') r.penaltyPaid = false;
    }
  }

  function rowHtml(r, i) {
    var options = paymentChoices().map(function (c) {
      return '<option value="' + c.v + '">' + esc(c.label) + '</option>';
    }).join('');
    return '<tr data-i="' + i + '">' +
      '<td class="num-col">' + r.number + '</td>' +
      '<td>' + fmtDate(r.dueDate) + '</td>' +
      '<td class="num" data-out="amount"></td>' +
      '<td><select data-k="payment">' + options + '</select></td>' +
      '<td><span class="badge" data-out="status"></span></td>' +
      '<td class="fee"><strong data-out="fee"></strong>' +
        '<label data-out="fee-paid"><input type="checkbox" data-k="penaltyPaid"' + (r.penaltyPaid ? ' checked' : '') + '> fee paid</label></td>' +
      '</tr>';
  }

  function renderTable() {
    $('#ledger tbody').innerHTML = ledger.rows.map(rowHtml).join('');
  }

  $('#ledger').addEventListener('change', function (e) {
    var input = e.target;
    var tr = input.closest('tr');
    if (!tr || !input.dataset.k) return;
    var i = Number(tr.dataset.i);
    var r = ledger.rows[i];
    if (input.dataset.k === 'payment') applyChoice(r, input.value, P.effectiveRows(ledger).rows[i].amountDue);
    else if (input.dataset.k === 'penaltyPaid') r.penaltyPaid = input.checked;
    refresh();
    queueSave();
  });

  $('#btn-edit-plan').addEventListener('click', function () { showSetup(true); });
  $('#btn-print').addEventListener('click', function () { window.print(); });

  function refresh() {
    var today = P.todayManila();
    var lateCount = 0;
    var overdueCount = 0;
    var eff = P.effectiveRows(ledger).rows;
    eff.forEach(function (r, i) {
      var tr = $('#ledger tbody tr[data-i="' + i + '"]');
      if (!tr) return;
      var s = P.rowStatus(r, today);
      if (s.key === 'paid-late') lateCount += 1;
      if (s.key === 'late') overdueCount += 1;
      $('[data-out="amount"]', tr).innerHTML = r.covered
        ? (r.amountDue ? peso(r.amountDue) + ' ' : '') + '<s class="muted">' + peso(r.originalDue) + '</s>'
        : peso(r.amountDue);
      var sel = $('select[data-k="payment"]', tr);
      sel.value = choiceFor(r);
      sel.disabled = !!s.covered;
      var badge = $('[data-out="status"]', tr);
      badge.textContent = s.label;
      badge.className = 'badge ' + s.key;
      tr.className = 'st-' + s.key;
      $('[data-out="fee"]', tr).textContent = s.penalty ? peso(s.penalty) : '—';
      $('[data-out="fee-paid"]', tr).hidden = !s.penalty;
    });

    var s = P.ledgerSummary(ledger, today);
    var n = ledger.rows.length;
    $('#st-paid').textContent = s.paymentsMade + ' of ' + n;
    $('#st-paid-sub').textContent = !s.paymentsLeft ? 'Fully paid'
      : s.paymentsLeft + ' to go' + (s.paymentsCovered ? ' · ' + s.paymentsCovered + ' covered by extra' : '');
    $('#st-late').textContent = String(lateCount + overdueCount);
    $('#st-late-sub').textContent = lateCount + ' paid late · ' + overdueCount + ' overdue now';
    $('#st-fees').textContent = peso(s.penaltiesOwed);
    $('#st-fees-sub').textContent = peso(s.penaltiesPaid) + ' already paid';
    $('#st-payoff').textContent = peso(s.payoff);
    $('#st-payoff-sub').textContent = peso(s.balance) + ' left on the schedule';
    renderExtras(s);

    var notice = $('#notice');
    notice.hidden = !s.noticeDue;
    if (s.noticeDue) {
      notice.textContent = s.overdueInARow + ' payments in a row are overdue. Under the late payment rule, send a written notice; ' +
        'he then has ' + P.CONFIG.lateFees.cureDays + ' days to catch up.';
    }
  }

  // ---------- extra payments (straight to principal) ----------

  function renderExtras(s) {
    var list = ledger.extraPayments || [];
    var perThousand = ledger.borrowed ? Math.round((1000 * s.totalDue) / ledger.borrowed) : 0;
    $('#x-help').textContent = 'Each ₱1,000 extra takes ' + peso(perThousand) + ' off the remaining payments (its interest is dropped). ' +
      'They come off the last months first, so the monthly stays the same and he finishes sooner. Principal left: ' +
      peso(s.principalLeft) + '.';
    $('#x-list').innerHTML = list.length
      ? list.map(function (x, i) {
        return '<tr><td>' + fmtDate(x.date) + '</td><td class="num">' + peso(x.amount) + '</td>' +
          '<td><button type="button" class="link-btn danger" data-del="' + i + '">Remove</button></td></tr>';
      }).join('') + '<tr class="row-total"><td>Total</td><td class="num">' + peso(s.extraPaid) + '</td><td></td></tr>'
      : '<tr><td colspan="3" class="muted">No extra payments yet.</td></tr>';
    $('#x-date').value = $('#x-date').value || P.todayManila();
  }

  $('#x-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var amount = money($('#x-amount').value);
    var date = $('#x-date').value || P.todayManila();
    var principal = P.ledgerSummary(ledger).principalLeft;
    var err = $('#x-error');
    err.hidden = true;
    if (amount <= 0) return;
    if (amount > principal) {
      err.textContent = 'That’s more than the ' + peso(principal) + ' principal left. To finish the plan, record ' + peso(principal) + '.';
      err.hidden = false;
      return;
    }
    ledger.extraPayments = (ledger.extraPayments || []).concat([{ date: date, amount: amount }])
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    $('#x-amount').value = '';
    refresh();
    queueSave();
  });

  $('#x-amount').addEventListener('input', function () {
    var raw = this.value.replace(/[^\d]/g, '');
    this.value = raw ? Number(raw).toLocaleString('en-PH') : '';
  });

  $('#x-list').addEventListener('click', function (e) {
    var i = e.target.dataset && e.target.dataset.del;
    if (i === undefined) return;
    var x = ledger.extraPayments[Number(i)];
    if (!confirm('Remove the ' + peso(x.amount) + ' extra payment from ' + fmtDate(x.date) + '?')) return;
    ledger.extraPayments.splice(Number(i), 1);
    refresh();
    queueSave();
  });

  if (key) open().catch(logout);
})();
