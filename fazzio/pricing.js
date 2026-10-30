/**
 * Fazzio installment math. All adjustable numbers live in CONFIG.
 * Interest is a flat monthly rate on the amount borrowed (the way dealer financing is quoted),
 * set to a share of the dealer's rate for the same number of months.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FazzioPricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONFIG = {
    cashPrice: 65000,
    minDownPayment: 0,
    minMonthlyPayment: 1000,
    maxMonths: 36,
    // Our rate = this share of the dealer's flat rate for the same length. Lengths between dealer quotes are
    // interpolated; shorter than the shortest quote uses the shortest quote's rate.
    shareOfDealerRate: 0.4968,
    monthlyRoundTo: 10,
    defaults: { downPayment: 0, monthlyPayment: 0 },
    // Late payment rule: a fee is added once each `afterDays` threshold is passed (per payment, never compounded).
    lateFees: {
      graceDays: 5,
      steps: [
        { afterDays: 5, amount: 100 },
        { afterDays: 15, amount: 200 },
      ],
      overdueInARowForNotice: 2,
      cureDays: 15,
    },
    dealer: {
      label: 'Honda Click 125 SE (Sumisho)',
      cashPrice: 59682,
      downPayment: 5968,
      monthlyRebate: 500,
      plans: [
        { months: 12, monthly: 6223 },
        { months: 18, monthly: 4686 },
        { months: 24, monthly: 3904 },
        { months: 36, monthly: 3116 },
      ],
    },
  };

  var SEARCH_LIMIT = 240;

  function peso(n) {
    var v = Number(n);
    if (!isFinite(v)) return '₱—';
    return (v < 0 ? '-₱' : '₱') + Math.abs(Math.round(v)).toLocaleString('en-PH');
  }

  function num(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).replace(/[₱,\s]/g, '');
    return s === '' ? NaN : Number(s);
  }

  function ceilTo(x, step) {
    return Math.ceil(x / step - 1e-9) * step;
  }

  /** Dealer's flat monthly rate (% of amount borrowed) for each quoted length, rebate applied. */
  function dealerMonthlyRates() {
    var d = CONFIG.dealer;
    var borrowed = d.cashPrice - d.downPayment;
    return d.plans.map(function (q) {
      var interest = (q.monthly - d.monthlyRebate) * q.months - borrowed;
      return { months: q.months, ratePct: (interest / borrowed / q.months) * 100 };
    }).sort(function (a, b) { return a.months - b.months; });
  }

  function monthlyRatePct(months) {
    return dealerMonthlyRatePct(months) * CONFIG.shareOfDealerRate;
  }

  function dealerMonthlyRatePct(months) {
    var pts = dealerMonthlyRates();
    var rate = pts[pts.length - 1].ratePct;
    if (months <= pts[0].months) rate = pts[0].ratePct;
    else {
      for (var i = 1; i < pts.length; i++) {
        if (months <= pts[i].months) {
          var a = pts[i - 1];
          var b = pts[i];
          rate = a.ratePct + ((b.ratePct - a.ratePct) * (months - a.months)) / (b.months - a.months);
          break;
        }
      }
    }
    return rate;
  }

  function priceFor(borrowed, months) {
    var rate = monthlyRatePct(months);
    var interest = Math.round((borrowed * rate * months) / 100);
    return { months: months, monthlyRatePct: rate, interest: interest, totalOfMonthly: borrowed + interest };
  }

  /** Smallest number of months in which `monthly` covers the total. */
  function monthsFor(borrowed, monthly) {
    for (var n = 1; n <= SEARCH_LIMIT; n++) {
      var p = priceFor(borrowed, n);
      if (n * monthly >= p.totalOfMonthly) return p;
    }
    return null;
  }

  function lowestMonthly(borrowed) {
    var p = priceFor(borrowed, CONFIG.maxMonths);
    var m = Math.max(CONFIG.minMonthlyPayment, ceilTo(p.totalOfMonthly / CONFIG.maxMonths, CONFIG.monthlyRoundTo));
    while (!monthsFor(borrowed, m) || monthsFor(borrowed, m).months > CONFIG.maxMonths) m += CONFIG.monthlyRoundTo;
    return m;
  }

  /** Lowest down payment (rounded up to ₱500) that lets `monthly` finish within the max months. */
  function downNeededFor(monthly) {
    for (var d = CONFIG.minDownPayment; d < CONFIG.cashPrice; d += 500) {
      var p = monthsFor(CONFIG.cashPrice - d, monthly);
      if (p && p.months <= CONFIG.maxMonths) return d;
    }
    return CONFIG.cashPrice;
  }

  /**
   * Principal still owed when `balance` of the monthly total is unpaid. Each payment is part principal and part
   * interest in the same ratio, so paying this amount settles the plan and drops all remaining interest.
   */
  function principalLeft(borrowed, balance, totalOfMonthly) {
    return totalOfMonthly > 0 ? Math.round((borrowed * balance) / totalOfMonthly) : 0;
  }

  /**
   * Returns { ok, problems[], fixes[], plan }.
   * `plan` is still filled in when the inputs break a rule (where it can be computed) so the page can show it.
   */
  function calculate(downInput, monthlyInput) {
    var problems = [];
    var fixes = [];
    var down = Math.round(num(downInput));
    var monthly = Math.round(num(monthlyInput));
    var cash = CONFIG.cashPrice;

    if (!isFinite(down) || down < 0) {
      problems.push('Enter a down payment.');
      fixes.push({ label: peso(CONFIG.minDownPayment) + ' down', downPayment: CONFIG.minDownPayment });
      return { ok: false, problems: problems, fixes: fixes, plan: null };
    }
    if (down > cash) {
      problems.push('The down payment can’t be more than the ' + peso(cash) + ' price.');
      fixes.push({ label: 'Pay ' + peso(cash) + ' in full', downPayment: cash });
      return { ok: false, problems: problems, fixes: fixes, plan: null };
    }
    if (down === cash) {
      return {
        ok: true, problems: [], fixes: [],
        plan: { cash: true, downPayment: cash, borrowed: 0, months: 0, monthlyPayment: 0, finalPayment: 0,
          monthlyRatePct: 0, yearlyRatePct: 0, interest: 0, totalOfMonthly: 0, total: cash, schedule: [] },
      };
    }
    if (down < CONFIG.minDownPayment) {
      problems.push('The minimum down payment is ' + peso(CONFIG.minDownPayment) + '.');
    }
    var fixDown = Math.max(down, CONFIG.minDownPayment);

    if (!isFinite(monthly) || monthly <= 0) {
      problems.push('Enter a monthly payment.');
      fixes.push({ label: peso(lowestMonthly(cash - fixDown)) + ' a month', downPayment: fixDown,
        monthlyPayment: lowestMonthly(cash - fixDown) });
      return { ok: false, problems: problems, fixes: fixes, plan: null };
    }

    var borrowed = cash - down;
    var p = monthsFor(borrowed, monthly);
    if (!p || p.months > CONFIG.maxMonths) {
      var minM = lowestMonthly(cash - fixDown);
      problems.push((p
        ? 'At ' + peso(monthly) + ' a month it would take ' + p.months + ' months. The longest plan is ' + CONFIG.maxMonths + ' months.'
        : 'At ' + peso(monthly) + ' a month it would take too long to pay off.') +
        ' With ' + peso(fixDown) + ' down, enter at least ' + peso(minM) + ' a month, or a bigger down payment.');
      fixes.push({ label: 'Pay ' + peso(minM) + ' a month', downPayment: fixDown, monthlyPayment: minM });
      var keep = Math.max(monthly, CONFIG.minMonthlyPayment);
      var needDown = downNeededFor(keep);
      if (needDown > fixDown && needDown < cash) {
        fixes.push({ label: 'Keep ' + peso(keep) + '/month with ' + peso(needDown) + ' down', downPayment: needDown, monthlyPayment: keep });
      }
    } else if (monthly < CONFIG.minMonthlyPayment) {
      problems.push('The minimum monthly payment is ' + peso(CONFIG.minMonthlyPayment) + '.');
      fixes.push({ label: peso(CONFIG.minMonthlyPayment) + ' a month', monthlyPayment: CONFIG.minMonthlyPayment });
    } else if (down < CONFIG.minDownPayment) {
      fixes.push({ label: peso(CONFIG.minDownPayment) + ' down', downPayment: CONFIG.minDownPayment });
    }

    if (!p) return { ok: false, problems: problems, fixes: fixes, plan: null };

    var pay = p.months === 1 ? p.totalOfMonthly : monthly;
    var finalPayment = p.totalOfMonthly - (p.months - 1) * pay;
    var schedule = [];
    var left = p.totalOfMonthly;
    for (var i = 1; i <= p.months; i++) {
      var amount = i === p.months ? finalPayment : pay;
      left -= amount;
      schedule.push({ number: i, amount: amount, balance: Math.max(0, left),
        payoff: principalLeft(borrowed, Math.max(0, left), p.totalOfMonthly) });
    }

    return {
      ok: problems.length === 0,
      problems: problems,
      fixes: fixes,
      plan: {
        cash: false,
        downPayment: down,
        borrowed: borrowed,
        months: p.months,
        monthlyPayment: pay,
        finalPayment: finalPayment,
        monthlyRatePct: p.monthlyRatePct,
        yearlyRatePct: p.monthlyRatePct * 12,
        interest: p.interest,
        totalOfMonthly: p.totalOfMonthly,
        total: down + p.totalOfMonthly,
        schedule: schedule,
      },
    };
  }

  /** Same-length plans side by side with the dealer quote (rebate applied every month). */
  /**
   * The Sumisho Honda Click with the same down payment and monthly payment (rebate already taken off the monthly),
   * at the dealer's own rate for that length. Returns { cash, minDownMissing, tooLong, months, ... } or null.
   */
  function dealerSameTerms(down, monthly) {
    var d = CONFIG.dealer;
    var maxMonths = d.plans.reduce(function (m, q) { return Math.max(m, q.months); }, 0);
    var out = { price: d.cashPrice, minDown: d.downPayment, minDownMissing: down < d.downPayment, maxMonths: maxMonths };
    var borrowed = d.cashPrice - down;
    if (borrowed <= 0) {
      out.cash = true;
      out.total = d.cashPrice;
      return out;
    }
    for (var n = 1; n <= SEARCH_LIMIT; n++) {
      var rate = dealerMonthlyRatePct(n);
      var interest = Math.round((borrowed * rate * n) / 100);
      if (n * monthly >= borrowed + interest) {
        out.months = n;
        out.monthlyRatePct = rate;
        out.yearlyRatePct = rate * 12;
        out.interest = interest;
        out.total = down + borrowed + interest;
        out.finalPayment = borrowed + interest - (n - 1) * monthly;
        out.tooLong = n > maxMonths;
        return out;
      }
    }
    out.tooLong = true;
    return out;
  }

  // ---------- late fees and payment tracking ----------

  function penaltyFor(daysLate) {
    return CONFIG.lateFees.steps.reduce(function (sum, s) {
      return daysLate > s.afterDays ? sum + s.amount : sum;
    }, 0);
  }

  function maxPenalty() {
    return penaltyFor(Infinity);
  }

  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }

  function toISO(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function daysBetween(fromISO, toISOStr) {
    return Math.round((parseISO(toISOStr) - parseISO(fromISO)) / 86400000);
  }

  function todayManila() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date());
  }

  /** Due dates one month apart starting the month after handover. dueDay 0 = same day of month as handover. */
  function dueDates(handoverISO, dueDay, count) {
    var t = parseISO(handoverISO);
    if (isNaN(t)) return [];
    var d = new Date(t);
    var day = dueDay >= 1 && dueDay <= 28 ? dueDay : d.getUTCDate();
    var out = [];
    for (var i = 1; i <= count; i++) {
      var y = d.getUTCFullYear();
      var mo = d.getUTCMonth() + i;
      var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      out.push(toISO(Date.UTC(y, mo, Math.min(day, last))));
    }
    return out;
  }

  /**
   * Status of one installment row:
   * { number, dueDate, amountDue, paidAmount, paidDate, daysLateOverride, penaltyWaived, penaltyPaid, note }
   * Days late count from the due date to the payment date, or to today while unpaid. An admin override wins.
   */
  function rowStatus(row, today) {
    today = today || todayManila();
    var due = Number(row.amountDue) || 0;
    var paid = Number(row.paidAmount) || 0;
    var fullyPaid = paid >= due && due > 0;
    var auto = 0;
    if (fullyPaid && row.paidDate) auto = Math.max(0, daysBetween(row.dueDate, row.paidDate));
    else if (!fullyPaid) auto = Math.max(0, daysBetween(row.dueDate, today));
    var override = row.daysLateOverride;
    var daysLate = override === null || override === undefined || override === '' ? auto : Math.max(0, Number(override) || 0);
    var penalty = penaltyFor(daysLate);
    var grace = CONFIG.lateFees.graceDays;
    var key;
    var label;
    if (fullyPaid) {
      key = daysLate > grace ? 'paid-late' : 'paid';
      label = daysLate > grace ? 'Paid late' : 'Paid';
    } else if (daysBetween(row.dueDate, today) < 0 && !(override > 0)) {
      key = paid > 0 ? 'partial' : 'upcoming';
      label = paid > 0 ? 'Partly paid' : 'Upcoming';
    } else if (daysLate <= grace) {
      key = 'grace';
      label = paid > 0 ? 'Partly paid · grace period' : 'Due · grace period';
    } else {
      key = 'late';
      label = (paid > 0 ? 'Partly paid · ' : 'Overdue · ') + daysLate + ' days late';
    }
    return {
      fullyPaid: fullyPaid,
      shortfall: Math.max(0, due - paid),
      autoDaysLate: auto,
      daysLate: daysLate,
      penalty: row.penaltyWaived ? 0 : penalty,
      penaltyBeforeWaiver: penalty,
      key: key,
      label: label,
    };
  }

  /** Plain-language late payment rule, shared by the buyer page and the tracker. */
  function lateRuleLines() {
    var lf = CONFIG.lateFees;
    var lines = ['Up to ' + lf.graceDays + ' days late: grace period, no fee.'];
    var total = 0;
    lf.steps.forEach(function (s, i) {
      total += s.amount;
      var next = lf.steps[i + 1];
      var range = next ? (s.afterDays + 1) + '–' + next.afterDays + ' days late' : 'More than ' + s.afterDays + ' days late';
      lines.push(range + ': ' + (i === 0 ? peso(s.amount) + ' late fee.' : 'another ' + peso(s.amount) + ' (' + peso(total) + ' total).'));
    });
    lines.push('The most a single payment can be charged is ' + peso(maxPenalty()) + '. Fees are per payment, never daily, never compounded.');
    lines.push(lf.overdueInARowForNotice + ' overdue payments in a row: written notice, with ' + lf.cureDays +
      ' days to catch up before any further steps.');
    return lines;
  }

  /** Totals for a tracked plan (see admin page for the ledger shape). */
  function ledgerSummary(ledger, today) {
    today = today || todayManila();
    var rows = ledger.rows || [];
    var totalDue = 0;
    var totalPaid = 0;
    var penaltiesOwed = 0;
    var penaltiesPaid = 0;
    var next = null;
    var streak = 0;
    rows.forEach(function (r) {
      var s = rowStatus(r, today);
      totalDue += Number(r.amountDue) || 0;
      totalPaid += Number(r.paidAmount) || 0;
      if (s.penalty > 0) {
        if (r.penaltyPaid) penaltiesPaid += s.penalty;
        else penaltiesOwed += s.penalty;
      }
      if (!s.fullyPaid && !next) next = { row: r, status: s };
      if (s.fullyPaid) streak = 0;
      else if (s.key === 'late') streak += 1;
    });
    var balance = Math.max(0, totalDue - totalPaid);
    var borrowed = Number(ledger.borrowed) || 0;
    var payoff = principalLeft(borrowed, balance, totalDue);
    return {
      totalDue: totalDue,
      totalPaid: totalPaid,
      balance: balance,
      penaltiesOwed: penaltiesOwed,
      penaltiesPaid: penaltiesPaid,
      payoff: payoff + penaltiesOwed,
      next: next,
      overdueInARow: streak,
      noticeDue: streak >= CONFIG.lateFees.overdueInARowForNotice,
    };
  }

  return {
    CONFIG: CONFIG,
    calculate: calculate,
    dealerSameTerms: dealerSameTerms,
    lowestMonthly: lowestMonthly,
    monthlyRatePct: monthlyRatePct,
    peso: peso,
    principalLeft: principalLeft,
    penaltyFor: penaltyFor,
    maxPenalty: maxPenalty,
    lateRuleLines: lateRuleLines,
    dueDates: dueDates,
    daysBetween: daysBetween,
    todayManila: todayManila,
    rowStatus: rowStatus,
    ledgerSummary: ledgerSummary,
  };
});
