(function () {
  'use strict';

  var P = window.FazzioPricing;
  var peso = P.peso;

  var A = window.FazzioAgreement;
  // The agreed deal. Shown until the seller starts tracking; after that the tracker's saved plan is used.
  var DEAL = A.DEAL;

  var $ = function (s) { return document.querySelector(s); };
  function set(sel, text) { $(sel).textContent = text; }
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

  function dealLedger() {
    var rows = [];
    var totalOfMonthly = DEAL.borrowed + DEAL.interest;
    for (var i = 1; i <= DEAL.months; i++) {
      var amount = i < DEAL.months ? DEAL.monthlyPayment : totalOfMonthly - (DEAL.months - 1) * DEAL.monthlyPayment;
      rows.push({ number: i, dueDate: '', amountDue: amount, paidAmount: 0 });
    }
    return { downPayment: DEAL.downPayment, monthlyPayment: DEAL.monthlyPayment, borrowed: DEAL.borrowed,
      interest: DEAL.interest, rows: rows, extraPayments: [] };
  }

  function render(ledger, started, loadFailed) {
    var today = P.todayManila();
    var eff = P.effectiveRows(ledger);
    var rows = eff.rows;
    var n = rows.length;
    var T = eff.totalOfMonthly;
    var B = eff.borrowed;
    var s = P.ledgerSummary(ledger, today);
    var interest = T - B;
    var monthly = Number(ledger.monthlyPayment) || (rows[0] && rows[0].originalDue) || 0;

    set('#h-monthly', peso(monthly));
    set('#h-months', String(n));

    // status
    set('#s-made', (started ? s.paymentsMade : 0) + ' of ' + n);
    set('#s-made-sub', started && !s.paymentsLeft ? 'All done'
      : (started ? s.paymentsLeft : n) + ' left' + (s.paymentsCovered ? ' · ' + s.paymentsCovered + ' covered by extra' : ''));
    if (!started) {
      set('#s-next', peso(monthly));
      set('#s-next-sub', 'First one is due a month after handover');
    } else if (!s.next) {
      set('#s-next', 'Fully paid');
      set('#s-next-sub', 'Thank you!');
    } else {
      var nr = s.next.row;
      set('#s-next', peso(nr.amountDue - (Number(nr.paidAmount) || 0)));
      set('#s-next-sub', 'Due ' + fmtDate(nr.dueDate) + (s.next.status.key === 'late' || s.next.status.key === 'grace' ? ' · ' + s.next.status.label : ''));
    }
    set('#s-balance', peso(s.balance));
    set('#s-balance-sub', 'of ' + peso(T) + ' in monthly payments');
    set('#s-payoff', peso(s.payoff));
    set('#s-payoff-sub', s.penaltiesOwed ? 'Includes ' + peso(s.penaltiesOwed) + ' in late fees' : 'Principal only, no more interest');

    var paidShare = T ? (s.totalPaid / T) * 100 : 0;
    var extraShare = T ? (eff.credit / T) * 100 : 0;
    $('#p-paid').style.width = paidShare + '%';
    $('#p-extra').style.width = extraShare + '%';
    var downPaid = started && !!ledger.handoverDate && ledger.handoverDate <= today;
    set('#lg-paid', downPaid
      ? 'Paid ' + peso(Number(ledger.downPayment) + s.totalPaid) + ' (including ' + peso(ledger.downPayment) + ' down)'
      : 'Paid ' + peso(s.totalPaid) + ' (down payment is due at handover)');
    $('#lg-extra-wrap').hidden = !eff.credit;
    set('#lg-extra', 'Extra payments: ' + peso(s.extraPaid) + ' (took ' + peso(eff.credit) + ' off the schedule)');

    var alerts = [];
    rows.forEach(function (r) {
      var st = started ? P.rowStatus(r, today) : null;
      if (st && st.key === 'late') alerts.push('Payment ' + r.number + ' (due ' + fmtDate(r.dueDate) + ') is ' + st.daysLate + ' days late.');
    });
    if (s.penaltiesOwed) alerts.push('Late fees owed: ' + peso(s.penaltiesOwed) + '.');
    $('#s-alert').hidden = !alerts.length;
    $('#s-alert').innerHTML = alerts.length ? '<ul>' + alerts.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '';

    set('#s-note', loadFailed ? 'Couldn’t load the latest payment status. Showing the plan only; try refreshing.'
      : !started ? 'Payment dates and status will show here once the handover date is set.'
      : ledger.updatedAt ? 'Last updated ' + new Date(ledger.updatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) + '.' : '');

    // plan
    var lastOpen = null;
    rows.forEach(function (r) { if (r.amountDue > 0) lastOpen = r; });
    var finalDiffers = rows[n - 1] && rows[n - 1].originalDue !== monthly;
    set('#d-price', peso(Number(ledger.downPayment) + B));
    set('#d-down', peso(ledger.downPayment) + (started ? ' · paid' : ''));
    set('#d-borrowed', peso(B));
    set('#d-monthly', peso(monthly) + ' × ' + (finalDiffers ? (n - 1) + ', then ' + peso(rows[n - 1].originalDue) : n));
    set('#d-interest', peso(interest) + ' · ' + (B && n ? ((interest / B / n) * 1200).toFixed(1) : '0') + '% a year, flat');
    set('#d-total', peso(Number(ledger.downPayment) + T));
    set('#d-first', started ? fmtDate(rows[0].dueDate) : 'A month after handover');
    set('#d-last', started ? fmtDate((lastOpen || rows[n - 1]).dueDate) : n + ' months after handover');

    // schedule
    var after = 0;
    var balanceAfter = rows.map(function () { return 0; });
    for (var i = n - 1; i >= 0; i--) { balanceAfter[i] = after; after += rows[i].amountDue; }
    var nextIndex = started && s.next ? s.next.index : -1;
    function badge(paid) {
      return paid ? '<span class="badge paid">Paid</span>' : '<span class="badge not-paid">Not paid</span>';
    }
    var downRow = '<tr class="row-down ' + (downPaid ? 'st-paid' : '') + '">' +
      '<td>Down</td>' +
      '<td>' + (started && ledger.handoverDate ? fmtDate(ledger.handoverDate) : 'At handover') + '</td>' +
      '<td class="num">' + peso(ledger.downPayment) + '</td>' +
      '<td>' + badge(downPaid) + '</td>' +
      '<td class="num">' + peso(after) + '</td>' +
      '<td class="num">' + peso(P.principalLeft(B, after, T)) + '</td>' +
      '</tr>';
    $('#schedule tbody').innerHTML = downRow + rows.map(function (r, i) {
      var st = started ? P.rowStatus(r, today) : null;
      var paid = !!(st && st.fullyPaid);
      var amount = r.covered
        ? peso(r.amountDue) + '<s>' + peso(r.originalDue) + '</s>'
        : peso(r.amountDue);
      var gone = st && st.covered;
      return '<tr class="' + (paid ? 'st-paid' : '') + (i === nextIndex ? ' is-next' : '') + '">' +
        '<td>' + r.number + '</td>' +
        '<td>' + (started ? fmtDate(r.dueDate) : 'Month ' + r.number) + '</td>' +
        '<td class="num">' + amount + '</td>' +
        '<td>' + badge(paid) + '</td>' +
        '<td class="num">' + (gone ? '—' : peso(balanceAfter[i])) + '</td>' +
        '<td class="num">' + (gone || !balanceAfter[i] ? '—' : peso(P.principalLeft(B, balanceAfter[i], T))) + '</td>' +
        '</tr>';
    }).join('');

    // extra payments
    set('#x-rate', 'Every ' + peso(1000) + ' extra takes ' + peso(B ? (1000 * T) / B : 0) + ' off what you still owe.');
    set('#x-payoff', peso(s.payoff));
    var extras = ledger.extraPayments || [];
    $('#x-box').hidden = !extras.length;
    $('#x-list').innerHTML = extras.map(function (x) {
      return '<tr><td>' + fmtDate(x.date) + '</td><td class="num">' + peso(x.amount) + '</td></tr>';
    }).join('') + (extras.length > 1 ? '<tr class="row-total"><td>Total</td><td class="num">' + peso(s.extraPaid) + '</td></tr>' : '');
  }

  $('#late-rule').innerHTML = P.lateRuleLines().map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
  $('#full-agreement').innerHTML = A.html({}, {});
  document.querySelectorAll('[data-deal="down"]').forEach(function (el) { el.textContent = peso(DEAL.downPayment); });
  document.querySelectorAll('[data-deal="monthly"]').forEach(function (el) { el.textContent = peso(DEAL.monthlyPayment); });

  fetch('/api/fazzio/agreement/status', { cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (st) {
      var when = function (iso) { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' }); };
      var text;
      if (st.buyerSignedAt && st.sellerSignedAt) text = 'Signed by both of you (' + when(st.buyerSignedAt) + '). Open your signing link anytime to view or save a copy.';
      else if (st.buyerSignedAt) text = 'You signed on ' + when(st.buyerSignedAt) + '. Waiting for the seller’s countersignature.';
      else if (st.open) text = 'Ready for you to sign.';
      else text = 'Not open for signing yet. You can read it below in the meantime.';
      set('#ag-status', text);
      $('#ag-link').textContent = st.buyerSignedAt ? 'View agreement' : 'Review and sign';
      if (st.buyerSignedAt) set('#ag-intro', 'This is the agreement you signed.');
    })
    .catch(function () { set('#ag-status', 'Couldn’t load the signing status.'); });

  render(dealLedger(), false, false);
  fetch('/api/fazzio/status', { cache: 'no-store' })
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(function (data) { if (data && data.rows && data.rows.length) render(data, true, false); })
    .catch(function () { render(dealLedger(), false, true); });
})();
