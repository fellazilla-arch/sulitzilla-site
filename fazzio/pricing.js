/**
 * Fazzio installment math. All adjustable numbers live in CONFIG.
 * Interest is a flat monthly rate on the amount borrowed (the way dealer financing is quoted),
 * and the rate rises gently with the number of months.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FazzioPricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONFIG = {
    cashPrice: 65000,
    minDownPayment: 10000,
    minMonthlyPayment: 1000,
    maxMonths: 36,
    // Monthly rate (% of amount borrowed) = base + step × months. 12 mo ≈ 0.68%, 24 mo ≈ 0.86%, 36 mo ≈ 1.04%.
    rateBasePct: 0.5,
    rateStepPct: 0.015,
    monthlyRoundTo: 10,
    defaults: { downPayment: 10000, monthlyPayment: 3000 },
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

  function monthlyRatePct(months) {
    return CONFIG.rateBasePct + CONFIG.rateStepPct * months;
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

  /** Flat yearly rate implied by a plan (for comparing with dealer quotes). */
  function flatYearlyPct(borrowed, interest, months) {
    return borrowed > 0 && months > 0 ? (interest / borrowed / months) * 12 * 100 : 0;
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
      problems.push(p
        ? 'At ' + peso(monthly) + ' a month it would take ' + p.months + ' months. The longest plan is ' + CONFIG.maxMonths + ' months.'
        : 'At ' + peso(monthly) + ' a month it would take too long to pay off.');
      var minM = lowestMonthly(cash - fixDown);
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
      schedule.push({ number: i, amount: amount, balance: Math.max(0, left) });
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
  function comparison(down) {
    var d = CONFIG.dealer;
    var dealerBorrowed = d.cashPrice - d.downPayment;
    return d.plans.map(function (q) {
      var net = q.monthly - d.monthlyRebate;
      var dealerTotal = d.downPayment + net * q.months;
      var ours = null;
      if (q.months <= CONFIG.maxMonths) {
        var borrowed = CONFIG.cashPrice - down;
        var p = priceFor(borrowed, q.months);
        var m = ceilTo(p.totalOfMonthly / q.months, CONFIG.monthlyRoundTo);
        ours = { monthly: m, total: down + p.totalOfMonthly, yearlyRatePct: p.monthlyRatePct * 12 };
      }
      return {
        months: q.months,
        dealer: {
          monthly: net,
          total: dealerTotal,
          yearlyRatePct: flatYearlyPct(dealerBorrowed, net * q.months - dealerBorrowed, q.months),
        },
        ours: ours,
      };
    });
  }

  return {
    CONFIG: CONFIG,
    calculate: calculate,
    comparison: comparison,
    lowestMonthly: lowestMonthly,
    monthlyRatePct: monthlyRatePct,
    peso: peso,
  };
});
