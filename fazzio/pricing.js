/**
 * Fazzio private-financing pricing engine.
 * Shared by the buyer page (window.FazzioPricing) and the server (require).
 * Every number the calculator uses comes from the config object; nothing here is page-specific.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FazzioPricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_CONFIG = {
    bike: {
      name: 'Yamaha Fazzio',
      year: 2025,
      odometerKm: 1200,
      condition: 'Excellent',
      modifications: 'Completely stock',
      registration: 'Registered',
      documents: 'Original OR/CR',
      color: '',
      photos: [],
    },
    cashPrice: 65000,
    comparable: {
      label: '2025 Yamaha Fazzio on Facebook Marketplace',
      odometerKm: 5000,
      askingPrice: 65000,
    },
    minDownPayment: 10000,
    minMonthlyPayment: 1500,
    minTermMonths: 1,
    maxTermMonths: 24,
    monthlyRoundTo: 10,
    premiumTiers: [
      { fromMonth: 1, toMonth: 6, monthlyRatePct: 0.5 },
      { fromMonth: 7, toMonth: 12, monthlyRatePct: 0.65 },
      { fromMonth: 13, toMonth: 18, monthlyRatePct: 0.8 },
      { fromMonth: 19, toMonth: 24, monthlyRatePct: 0.9 },
    ],
    dueDay: 0,
    minDaysToFirstPayment: 20,
    lateFees: {
      graceDays: 5,
      fees: [
        { fromDay: 6, toDay: 15, amount: 100 },
        { fromDay: 16, toDay: 30, amount: 200 },
      ],
      writtenNoticeAfterDays: 30,
    },
    defaultRules: {
      formalNoticeAfterConsecutiveMissed: 2,
      remediesAfterMissed: 3,
      cureDays: 15,
    },
    dealerComparison: {
      label: 'Honda Click 125 Special Edition (Sumisho dealer financing)',
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
    seller: {
      name: '',
      contact: '',
    },
    defaults: {
      downPayment: 10000,
      monthlyPayment: 3000,
      termMonths: 12,
    },
  };

  var EXTRAPOLATE_LIMIT_MONTHS = 120;

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /** Deep-merge saved settings over defaults. Arrays replace rather than merge. */
  function mergeConfig(saved) {
    function merge(base, over) {
      if (!isPlainObject(over)) return base;
      var out = clone(base);
      Object.keys(over).forEach(function (k) {
        if (isPlainObject(base[k]) && isPlainObject(over[k])) out[k] = merge(base[k], over[k]);
        else if (over[k] !== undefined) out[k] = clone(over[k]);
      });
      return out;
    }
    return merge(DEFAULT_CONFIG, saved || {});
  }

  function num(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    var s = String(v).replace(/[₱,\s]/g, '');
    if (s === '') return NaN;
    return Number(s);
  }

  function ceilTo(x, step) {
    step = step || 1;
    return Math.ceil(x / step - 1e-9) * step;
  }

  function floorTo(x, step) {
    step = step || 1;
    return Math.floor(x / step + 1e-9) * step;
  }

  function peso(n, opts) {
    var digits = opts && opts.decimals ? 2 : 0;
    var v = Number(n);
    if (!isFinite(v)) return '₱—';
    return (
      (v < 0 ? '-' : '') +
      '₱' +
      Math.abs(v).toLocaleString('en-PH', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    );
  }

  function sortedTiers(cfg) {
    return (cfg.premiumTiers || []).slice().sort(function (a, b) {
      return a.fromMonth - b.fromMonth;
    });
  }

  /** Tier for a term. Beyond the last tier, the last tier's rate is used (only for "outside terms" previews). */
  function tierFor(cfg, months, allowExtrapolate) {
    var tiers = sortedTiers(cfg);
    for (var i = 0; i < tiers.length; i++) {
      if (months >= tiers[i].fromMonth && months <= tiers[i].toMonth) return tiers[i];
    }
    if (allowExtrapolate && tiers.length && months > tiers[tiers.length - 1].toMonth) {
      return tiers[tiers.length - 1];
    }
    return null;
  }

  function priceForTerm(cfg, financed, months, allowExtrapolate) {
    var tier = tierFor(cfg, months, allowExtrapolate);
    if (!tier) return null;
    var premium = Math.round((financed * tier.monthlyRatePct * months) / 100);
    return {
      months: months,
      monthlyRatePct: tier.monthlyRatePct,
      premium: premium,
      totalOfMonthly: financed + premium,
    };
  }

  /** Smallest term where `monthly` covers the term's total. Payments are equal except the last. */
  function termForMonthly(cfg, financed, monthly, limit) {
    for (var n = Math.max(1, cfg.minTermMonths || 1); n <= limit; n++) {
      var p = priceForTerm(cfg, financed, n, true);
      if (!p) continue;
      if (n * monthly >= p.totalOfMonthly - 1e-9) return p;
    }
    return null;
  }

  function minMonthlyForMaxTerm(cfg, financed) {
    var p = priceForTerm(cfg, financed, cfg.maxTermMonths, false);
    if (!p) return null;
    var m = Math.max(cfg.minMonthlyPayment, ceilTo(p.totalOfMonthly / cfg.maxTermMonths, cfg.monthlyRoundTo));
    // Rounding can leave the plan one month short of covering; nudge until it fits.
    while (termForMonthly(cfg, financed, m, cfg.maxTermMonths) === null) m += cfg.monthlyRoundTo || 1;
    return m;
  }

  /** Lowest down payment (rounded up to ₱500) that lets `monthly` finish within the max term. */
  function minDownForMonthly(cfg, monthly) {
    var tier = tierFor(cfg, cfg.maxTermMonths, false);
    if (!tier) return null;
    var n = cfg.maxTermMonths;
    var maxFinanced = (monthly * n) / (1 + (tier.monthlyRatePct * n) / 100);
    var down = Math.max(cfg.minDownPayment, ceilTo(cfg.cashPrice - maxFinanced, 500));
    while (down < cfg.cashPrice && termForMonthly(cfg, cfg.cashPrice - down, monthly, n) === null) down += 500;
    return Math.min(down, cfg.cashPrice);
  }

  // ---------- dates (calendar dates in UTC to avoid timezone drift) ----------

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtISO(d) {
    return d.toISOString().slice(0, 10);
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  }

  function dateWithDay(y, m, day) {
    var yy = y + Math.floor(m / 12);
    var mm = ((m % 12) + 12) % 12;
    return new Date(Date.UTC(yy, mm, Math.min(day, daysInMonth(yy, mm))));
  }

  function dueDates(cfg, handover, count) {
    var out = [];
    var y = handover.getUTCFullYear();
    var m = handover.getUTCMonth();
    var fixed = Number(cfg.dueDay) >= 1 && Number(cfg.dueDay) <= 28;
    var day = fixed ? Number(cfg.dueDay) : handover.getUTCDate();
    var offset = 1;
    if (fixed) {
      var first = dateWithDay(y, m + 1, day);
      var gap = (first - handover) / 86400000;
      if (gap < (cfg.minDaysToFirstPayment || 0)) offset = 2;
    }
    for (var i = 0; i < count; i++) out.push(fmtISO(dateWithDay(y, m + offset + i, day)));
    return out;
  }

  // ---------- rate disclosure ----------

  /** Effective annual rate (IRR) for lending `financed` and receiving `payments` monthly. */
  function effectiveAnnualRatePct(financed, payments) {
    if (!(financed > 0) || !payments.length) return 0;
    var total = payments.reduce(function (a, b) { return a + b; }, 0);
    if (total <= financed) return 0;
    function npv(r) {
      var v = -financed;
      for (var i = 0; i < payments.length; i++) v += payments[i] / Math.pow(1 + r, i + 1);
      return v;
    }
    var lo = 0;
    var hi = 1;
    for (var k = 0; k < 200; k++) {
      var mid = (lo + hi) / 2;
      if (npv(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (Math.pow(1 + lo, 12) - 1) * 100;
  }

  // ---------- main entry ----------

  /**
   * input: { mode: 'monthly' | 'term', downPayment, monthlyPayment, termMonths, handoverDate: 'YYYY-MM-DD' }
   * Returns { status: 'plan' | 'cash' | 'invalid', withinTerms, issues[], suggestions[], notes[], plan }
   * `plan` is still returned for out-of-terms inputs when it can be computed, so the page can show what the
   * proposal would look like alongside the warning.
   */
  function buildPlan(cfg, input) {
    var issues = [];
    var suggestions = [];
    var notes = [];
    var mode = input.mode === 'term' ? 'term' : 'monthly';
    var down = num(input.downPayment);
    var cash = cfg.cashPrice;

    function suggest(label, patch) {
      var key = JSON.stringify(patch);
      if (!suggestions.some(function (s) { return JSON.stringify(s.patch) === key; })) {
        suggestions.push({ label: label, patch: patch });
      }
    }

    if (!isFinite(down) || down < 0) {
      issues.push({ field: 'downPayment', message: 'Enter a down payment amount.' });
      suggest('Use ' + peso(cfg.minDownPayment) + ' down', { downPayment: cfg.minDownPayment });
      return result('invalid', null);
    }
    down = Math.round(down);
    if (down > cash) {
      issues.push({
        field: 'downPayment',
        message: 'The down payment can’t be more than the full cash price of ' + peso(cash) + '.',
      });
      suggest('Pay ' + peso(cash) + ' in full', { downPayment: cash });
      return result('invalid', null);
    }
    if (down === cash) {
      notes.push('A down payment of ' + peso(cash) + ' is a full cash purchase — no financing needed.');
      return result('cash', {
        cashPrice: cash,
        downPayment: cash,
        financed: 0,
        months: 0,
        monthlyRatePct: 0,
        premium: 0,
        monthlyPayment: 0,
        finalPayment: 0,
        totalOfMonthly: 0,
        totalInstallmentPrice: cash,
        effectiveAnnualRatePct: 0,
        schedule: [],
        firstDueDate: null,
        finalDueDate: null,
      });
    }
    if (down < cfg.minDownPayment) {
      issues.push({
        field: 'downPayment',
        message: 'The minimum down payment is ' + peso(cfg.minDownPayment) + '.',
      });
      suggest('Use ' + peso(cfg.minDownPayment) + ' down', { downPayment: cfg.minDownPayment });
    }

    var financed = cash - down;
    var price = null;
    var monthly = 0;
    // Suggestions are computed against a valid down payment so they're immediately acceptable.
    var downTooLow = down < cfg.minDownPayment;
    var fixDown = downTooLow ? cfg.minDownPayment : down;
    var fixFinanced = cash - fixDown;
    function withDown(patch) {
      if (downTooLow) patch.downPayment = fixDown;
      return patch;
    }
    function downLabel() {
      return downTooLow ? ' with ' + peso(fixDown) + ' down' : '';
    }

    if (mode === 'monthly') {
      monthly = num(input.monthlyPayment);
      if (!isFinite(monthly) || monthly <= 0) {
        issues.push({ field: 'monthlyPayment', message: 'Enter a monthly payment above ₱0.' });
        suggest('Pay ' + peso(cfg.defaults.monthlyPayment) + ' a month', {
          monthlyPayment: cfg.defaults.monthlyPayment,
        });
        return result('invalid', null);
      }
      monthly = Math.round(monthly);
      if (monthly < cfg.minMonthlyPayment) {
        issues.push({
          field: 'monthlyPayment',
          message: 'The minimum monthly payment is ' + peso(cfg.minMonthlyPayment) + '.',
        });
      }
      price = termForMonthly(cfg, financed, monthly, EXTRAPOLATE_LIMIT_MONTHS);
      var minM = minMonthlyForMaxTerm(cfg, fixFinanced);
      if (!price || price.months > cfg.maxTermMonths) {
        issues.push({
          field: 'monthlyPayment',
          message: price
            ? 'At ' + peso(monthly) + ' a month this would take ' + price.months + ' months — the longest plan is ' +
              cfg.maxTermMonths + ' months.'
            : 'At ' + peso(monthly) + ' a month the balance would never be paid off.',
        });
        if (minM) {
          suggest('Pay ' + peso(minM) + ' a month' + downLabel() + ' (' + cfg.maxTermMonths + ' months)',
            withDown({ monthlyPayment: minM }));
        }
        var keepMonthly = Math.max(monthly, cfg.minMonthlyPayment);
        var needDown = minDownForMonthly(cfg, keepMonthly);
        if (needDown && needDown > down && needDown < cash) {
          suggest('Keep ' + peso(keepMonthly) + '/month with ' + peso(needDown) + ' down', {
            downPayment: needDown,
            monthlyPayment: keepMonthly,
          });
        }
      } else if (monthly < cfg.minMonthlyPayment && minM) {
        suggest('Pay ' + peso(minM) + ' a month' + downLabel(), withDown({ monthlyPayment: minM }));
      }
      if (price && price.months === 1 && monthly > price.totalOfMonthly) {
        notes.push('Your monthly amount covers the whole balance, so this is a single payment of ' +
          peso(price.totalOfMonthly) + '.');
      }
    } else {
      var n = Math.round(num(input.termMonths));
      if (!isFinite(n) || n < 1) {
        issues.push({ field: 'termMonths', message: 'Choose how many months you want to pay.' });
        suggest(cfg.defaults.termMonths + ' months', { termMonths: cfg.defaults.termMonths });
        return result('invalid', null);
      }
      if (n > cfg.maxTermMonths || n < (cfg.minTermMonths || 1)) {
        issues.push({
          field: 'termMonths',
          message: 'Plans run from ' + (cfg.minTermMonths || 1) + ' to ' + cfg.maxTermMonths + ' months.',
        });
        var clamped = Math.min(cfg.maxTermMonths, Math.max(cfg.minTermMonths || 1, n));
        suggest(clamped + ' months' + downLabel(), withDown({ termMonths: clamped }));
        n = clamped;
      }
      price = priceForTerm(cfg, financed, n, true);
      if (price) {
        monthly = ceilTo(price.totalOfMonthly / n, cfg.monthlyRoundTo);
        if ((n - 1) * monthly >= price.totalOfMonthly) monthly = ceilTo(price.totalOfMonthly / n, 1);
        if (monthly < cfg.minMonthlyPayment) {
          var longest = 1;
          for (var t = 1; t <= cfg.maxTermMonths; t++) {
            var pt = priceForTerm(cfg, fixFinanced, t, false);
            if (pt && pt.totalOfMonthly / t >= cfg.minMonthlyPayment) longest = t;
          }
          issues.push({
            field: 'termMonths',
            message: 'Over ' + n + ' months the monthly payment would be ' + peso(monthly) +
              ', below the ' + peso(cfg.minMonthlyPayment) + ' minimum.',
          });
          suggest(longest + ' months' + downLabel(), withDown({ termMonths: longest }));
        }
      }
    }

    if (!price) return result('invalid', null);

    var months = price.months;
    if (months === 1) monthly = price.totalOfMonthly;
    var finalPayment = price.totalOfMonthly - (months - 1) * monthly;

    var handover = parseDate(input.handoverDate) || parseDate(fmtISO(new Date()));
    var dates = dueDates(cfg, handover, months);
    var schedule = [];
    var principalShare = financed / price.totalOfMonthly;
    var remaining = price.totalOfMonthly;
    var principalPaid = 0;
    var payments = [];
    for (var i = 1; i <= months; i++) {
      var amount = i === months ? finalPayment : monthly;
      payments.push(amount);
      remaining -= amount;
      var principalPart = i === months ? financed - principalPaid : Math.round(amount * principalShare);
      principalPaid += principalPart;
      schedule.push({
        number: i,
        dueDate: dates[i - 1],
        amount: amount,
        principal: principalPart,
        financingCharge: amount - principalPart,
        remainingBalance: Math.max(0, remaining),
        payoffAfter: Math.max(0, financed - principalPaid),
      });
    }

    return result(issues.length ? 'invalid' : 'plan', {
      mode: mode,
      handoverDate: fmtISO(handover),
      cashPrice: cash,
      downPayment: down,
      financed: financed,
      months: months,
      monthlyRatePct: price.monthlyRatePct,
      premium: price.premium,
      monthlyPayment: monthly,
      finalPayment: finalPayment,
      totalOfMonthly: price.totalOfMonthly,
      totalInstallmentPrice: down + price.totalOfMonthly,
      effectiveAnnualRatePct: effectiveAnnualRatePct(financed, payments),
      schedule: schedule,
      firstDueDate: dates[0],
      finalDueDate: dates[dates.length - 1],
    });

    function result(status, plan) {
      return {
        status: status,
        withinTerms: issues.length === 0 && status !== 'invalid',
        issues: issues,
        suggestions: suggestions,
        notes: notes,
        plan: plan,
      };
    }
  }

  /** Dealer quote totals (with the monthly rebate applied every month) for the comparison table. */
  function dealerTotals(cfg) {
    var d = cfg.dealerComparison;
    if (!d || !d.plans) return [];
    return d.plans.map(function (p) {
      var net = p.monthly - (d.monthlyRebate || 0);
      var total = d.downPayment + net * p.months;
      var financed = d.cashPrice - d.downPayment;
      var payments = [];
      for (var i = 0; i < p.months; i++) payments.push(net);
      return {
        months: p.months,
        monthly: p.monthly,
        netMonthly: net,
        total: total,
        premium: total - d.cashPrice,
        effectiveAnnualRatePct: effectiveAnnualRatePct(financed, payments),
      };
    });
  }

  /** Validates a merged config; returns a list of human-readable problems (empty = OK). */
  function validateConfig(cfg) {
    var errs = [];
    function pos(v, name) {
      if (!(typeof v === 'number' && isFinite(v) && v > 0)) errs.push(name + ' must be a number above 0.');
    }
    pos(cfg.cashPrice, 'Cash benchmark');
    if (!(cfg.minDownPayment >= 0 && cfg.minDownPayment < cfg.cashPrice)) {
      errs.push('Minimum down payment must be at least 0 and below the cash benchmark.');
    }
    pos(cfg.minMonthlyPayment, 'Minimum monthly payment');
    if (!(Number.isInteger(cfg.maxTermMonths) && cfg.maxTermMonths >= 1 && cfg.maxTermMonths <= 60)) {
      errs.push('Maximum duration must be a whole number of months from 1 to 60.');
    }
    if (!(Number.isInteger(cfg.minTermMonths) && cfg.minTermMonths >= 1 && cfg.minTermMonths <= cfg.maxTermMonths)) {
      errs.push('Minimum duration must be a whole number from 1 up to the maximum duration.');
    }
    if (!(cfg.monthlyRoundTo >= 1)) errs.push('Monthly rounding must be at least ₱1.');
    var tiers = sortedTiers(cfg);
    if (!tiers.length) errs.push('Add at least one financing premium tier.');
    var expect = 1;
    tiers.forEach(function (t, i) {
      if (!(Number.isInteger(t.fromMonth) && Number.isInteger(t.toMonth) && t.toMonth >= t.fromMonth)) {
        errs.push('Tier ' + (i + 1) + ' needs whole-number months with “to” ≥ “from”.');
      } else if (t.fromMonth !== expect) {
        errs.push('Tiers must start at month 1 and have no gaps or overlaps (expected a tier starting at month ' + expect + ').');
      }
      if (!(typeof t.monthlyRatePct === 'number' && t.monthlyRatePct >= 0 && t.monthlyRatePct <= 10)) {
        errs.push('Tier ' + (i + 1) + ' rate must be between 0% and 10% per month.');
      }
      expect = t.toMonth + 1;
    });
    if (tiers.length && tiers[tiers.length - 1].toMonth < cfg.maxTermMonths) {
      errs.push('Tiers must cover every month up to the maximum duration (' + cfg.maxTermMonths + ').');
    }
    if (!(Number.isInteger(cfg.dueDay) && cfg.dueDay >= 0 && cfg.dueDay <= 28)) {
      errs.push('Due day must be 0 (same day as handover) or 1–28.');
    }
    var lf = cfg.lateFees || {};
    if (!(lf.graceDays >= 0)) errs.push('Grace period must be 0 days or more.');
    (lf.fees || []).forEach(function (f, i) {
      if (!(f.amount >= 0 && f.fromDay >= 1 && f.toDay >= f.fromDay)) errs.push('Late fee row ' + (i + 1) + ' is incomplete.');
    });
    var dr = cfg.defaultRules || {};
    if (!(dr.cureDays >= 0)) errs.push('Cure period must be 0 days or more.');
    if (!(dr.formalNoticeAfterConsecutiveMissed >= 1 && dr.remediesAfterMissed >= dr.formalNoticeAfterConsecutiveMissed)) {
      errs.push('Default thresholds must be at least 1, and remedies must come at or after the formal notice.');
    }
    return errs;
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    mergeConfig: mergeConfig,
    validateConfig: validateConfig,
    buildPlan: buildPlan,
    priceForTerm: priceForTerm,
    dealerTotals: dealerTotals,
    effectiveAnnualRatePct: effectiveAnnualRatePct,
    peso: peso,
    num: num,
    ceilTo: ceilTo,
    floorTo: floorTo,
  };
});
