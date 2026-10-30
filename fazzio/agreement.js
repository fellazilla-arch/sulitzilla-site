/**
 * Fazzio installment agreement: one template shared by the buyer page, the signing page and the server.
 * The server hashes toText() at signing time, so formatting here must not depend on the runtime's locale.
 * No personal details live in this file (the repo is public); they're filled in from server-side data.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pricing.js'));
  else root.FazzioAgreement = factory(root.FazzioPricing);
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  var VERSION = '2026-10-30';

  var DEAL = { cashPrice: 65000, downPayment: 4000, monthlyPayment: 3000, months: 26, borrowed: 61000, interest: 17000 };
  DEAL.total = DEAL.downPayment + DEAL.monthlyPayment * DEAL.months;

  var DETAIL_FIELDS = [
    { key: 'sellerName', label: 'Seller’s full name' },
    { key: 'sellerAddress', label: 'Seller’s address' },
    { key: 'color', label: 'Motorcycle color' },
    { key: 'plate', label: 'Plate no.' },
    { key: 'engineNo', label: 'Engine no.' },
    { key: 'chassisNo', label: 'Chassis no.' },
    { key: 'mvFileNo', label: 'MV file no.' },
    { key: 'handoverDate', label: 'Handover date', type: 'date' },
    { key: 'dueDay', label: 'Payments due on', type: 'dueday' },
    { key: 'paymentMethod', label: 'How he pays', placeholder: 'e.g. GCash or bank transfer' },
    { key: 'venue', label: 'City for any court case' },
    { key: 'orcr', label: 'OR/CR', type: 'orcr' },
  ];

  var BUYER_FIELDS = [
    { key: 'name', label: 'Full legal name' },
    { key: 'address', label: 'Home address' },
    { key: 'idType', label: 'Government ID type', placeholder: 'e.g. Driver’s license' },
    { key: 'idNumber', label: 'ID number' },
  ];

  var ORCR = {
    copy: 'a photocopy of the OR/CR and a signed authorization to use the motorcycle',
    original: 'the original OR/CR, to keep with the motorcycle while this agreement is in force',
  };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function money(n) {
    return '₱' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function longDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : '';
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function clean(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  /** Details are complete when every seller-side field is filled in. */
  function missingDetails(d) {
    d = d || {};
    return DETAIL_FIELDS.filter(function (f) {
      if (f.key === 'dueDay') return !(Number(d.dueDay) >= 0);
      if (f.key === 'orcr') return !ORCR[d.orcr];
      return !clean(d[f.key]);
    }).map(function (f) { return f.label; });
  }

  function missingBuyer(b) {
    b = b || {};
    return BUYER_FIELDS.filter(function (f) { return !clean(b[f.key]); }).map(function (f) { return f.label; });
  }

  /**
   * The agreement as a list of blocks: { h } heading, { p } paragraph, { ul: [] } bullets.
   * Missing values render as [placeholders] so the terms can be shown before details are known.
   */
  function blocks(details, buyer) {
    var d = details || {};
    var b = buyer || {};
    var v = function (val, placeholder) { val = clean(val); return val || '[' + placeholder + ']'; };
    var dates = d.handoverDate ? P.dueDates(d.handoverDate, Number(d.dueDay) || 0, DEAL.months) : [];
    var dueDay = dates.length ? ordinal(+dates[0].slice(8, 10)) : '[day]';
    var M = DEAL.monthlyPayment;

    return [
      { title: 'CONTRACT TO SELL A MOTORCYCLE ON INSTALLMENT' },
      { p: 'This agreement is made between:' },
      { p: 'SELLER: ' + v(d.sellerName, 'seller’s full name') + ', of legal age, residing at ' + v(d.sellerAddress, 'seller’s address') + '.' },
      { p: 'BUYER: ' + v(b.name, 'buyer’s full name') + ', of legal age, residing at ' + v(b.address, 'buyer’s address') + ', with ' +
        v(b.idType, 'ID type') + ' no. ' + v(b.idNumber, 'ID number') + '.' },

      { h: '1. The motorcycle.' },
      { p: '2025 Yamaha Fazzio, ' + v(d.color, 'color') + ', plate no. ' + v(d.plate, 'plate no.') + ', engine no. ' + v(d.engineNo, 'engine no.') +
        ', chassis no. ' + v(d.chassisNo, 'chassis no.') + ', MV file no. ' + v(d.mvFileNo, 'MV file no.') +
        ', registered in the Seller’s name, with about 1,200 km on the odometer. The Buyer has inspected the motorcycle and accepts it in its current condition.' },

      { h: '2. Price and payments.' },
      { p: 'The cash price is ' + money(DEAL.cashPrice) + '. On installment, the total price is ' + money(DEAL.total) + ', paid as follows:' },
      { ul: [
        money(DEAL.downPayment) + ' down payment at handover on ' + (longDate(d.handoverDate) || '[handover date]') + '.',
        DEAL.months + ' monthly payments of ' + money(M) + ', due on the ' + dueDay + ' of each month, from ' +
          (longDate(dates[0]) || '[first due date]') + ' to ' + (longDate(dates[dates.length - 1]) || '[last due date]') + '.',
      ] },
      { p: 'Payments are made by ' + v(d.paymentMethod, 'payment method') + '. A payment is on time if the Seller receives it by its due date.' },

      { h: '3. Late payments.' },
      { ul: [
        'Up to 5 days late: no fee.',
        '6 to 15 days late: ₱100 fee.',
        'More than 15 days late: another ₱200 fee (₱300 in total).',
        'No more than ₱300 in fees per payment. Fees are never charged daily and never compounded.',
      ] },

      { h: '4. Extra payments and paying off early.' },
      { p: 'The Buyer may pay extra, or pay off the whole balance, at any time with no penalty. Extra payments go to the principal, the interest on that amount is waived, and they reduce the last payments first. The payoff amount at any time is the principal still owed, as shown on the payment page.' },

      { h: '5. Payment record.' },
      { p: 'The Seller keeps the record of payments at sulitzilla.com/fazzio, where the Buyer can see it at any time. If there is ever a disagreement, receipts and transfer records decide it.' },

      { h: '6. Ownership.' },
      { p: 'Ownership of the motorcycle stays with the Seller until every payment is made. The registration (OR/CR) stays in the Seller’s name. The Seller gives the Buyer ' +
        (ORCR[d.orcr] || '[OR/CR arrangement]') + '.' },

      { h: '7. The Buyer’s obligations until fully paid.' },
      { ul: [
        'Use the motorcycle at the Buyer’s own risk.',
        'Pay for maintenance, registration renewal and CTPL insurance on time, with the registration staying in the Seller’s name, except as provided in clause 12.3.',
        'Not sell, pawn, rent out, lend for long periods, use as collateral, or hand over possession of the motorcycle.',
        'Make no major modifications.',
        'Tell the Seller of any change of address or phone number.',
        'Allow the Seller to inspect the motorcycle with reasonable notice.',
      ] },

      { h: '8. Risk and liability.' },
      { p: 'From handover, except while the Seller holds the motorcycle during a suspension (clause 12.4), the Buyer bears the risk if the motorcycle is lost, stolen or damaged, and still owes the full balance in those cases. The Buyer is responsible for, and will reimburse the Seller for, all traffic violations, camera (NCAP) tickets, fines, accident claims, third-party claims and related costs (including legal fees) that arise while the Buyer has the motorcycle. The Buyer reports any accident or theft to the Seller within 24 hours.' },

      { h: '9. Insurance.' },
      { p: 'The Buyer keeps the required CTPL insurance in force. Any other insurance is the Buyer’s choice and cost.' },

      { h: '10. Default.' },
      { p: 'The Buyer is in default if (a) two or more monthly payments are overdue, or (b) the Buyer sells, pawns, gives up possession of, or abandons the motorcycle. For (a), the Seller first sends a written notice by text or chat and on paper, and the Buyer has 15 days to pay everything overdue plus late fees. No installment falls due, and no default under (a) can arise, during a suspension under clause 12.' },

      { h: '11. If the default is not fixed.' },
      { p: 'The Seller may cancel this agreement. The Buyer must then hand over the motorcycle, keys, documents and accessories at the Seller’s address within 7 days, in good condition apart from normal wear. Everything the Buyer has paid (down payment, monthly payments, extra payments and fees) is kept by the Seller as rent for the use of the motorcycle and compensation for its depreciation. The Buyer also pays for repairs beyond normal wear, any unpaid violations, and the costs of recovering the motorcycle if the Buyer does not hand it over voluntarily.' },

      { h: '12. Temporary payment suspension and voluntary surrender.' },
      { p: 'The Seller recognizes that the Buyer may occasionally experience financial difficulties or circumstances that temporarily prevent him from continuing monthly payments. Rather than immediately cancelling the agreement, the Buyer may temporarily suspend payments and return the motorcycle to the Seller until he is ready to resume.' },
      { p: '12.1 Requesting a suspension. The Buyer may request a temporary payment suspension at any time during the agreement, as long as no more than one (1) monthly installment is overdue when he requests it, and may do so more than once. If two or more installments are overdue, he may request a suspension once he has paid enough to bring it back to one or none. The Seller shall not refuse a suspension request that meets this condition. The suspension takes effect when the Buyer requests it in writing and surrenders the motorcycle, and the Seller confirms it in writing.' },
      { p: '12.2 Temporary surrender of the motorcycle. Upon the start of the suspension:' },
      { ul: [
        'The Buyer shall surrender the motorcycle, keys, and accessories to the Seller.',
        'The Seller shall retain physical possession of the motorcycle throughout the suspension period.',
        'The Seller shall not use, rent, lend, sell, or otherwise dispose of the motorcycle, except as provided in clause 12.8.',
        'The Seller shall take reasonable care of the motorcycle while it is in his possession.',
        'Both parties shall document the motorcycle’s condition and odometer reading upon surrender.',
      ] },
      { p: '12.3 Registration and insurance during a suspension. If the registration renewal or CTPL insurance falls due during a suspension, the Seller shall pay it to keep the motorcycle registered and insured. The Buyer shall reimburse the exact amount, as shown by the receipts, together with his first payment after resuming.' },
      { p: '12.4 Risk while the Seller holds the motorcycle. During a suspension, the Seller bears all risk of loss, theft, and damage to the motorcycle, at his own cost. Any damage that occurs while the Seller holds it shall be repaired at the Seller’s cost before it is returned. If the motorcycle is lost, stolen, or destroyed beyond repair while the Seller holds it, this agreement ends and the Seller shall refund to the Buyer everything the Buyer has paid toward the price within thirty (30) days.' },
      { p: '12.5 Treatment of previous payments. All payments previously made by the Buyer, including the down payment, monthly installments, and additional principal payments, shall remain fully credited toward the agreed purchase price. Temporary surrender shall not constitute cancellation of the sale or forfeiture of previously paid amounts, except as provided in clause 12.8. No refund shall be issued during the suspension period because the installment agreement remains active.' },
      { p: '12.6 Suspension of monthly payments. During a suspension:' },
      { ul: [
        'No monthly installments shall be due.',
        'No late fees or penalties shall accrue.',
        'No additional interest or administrative charges shall be imposed solely because of the suspension.',
        'The original agreed purchase price and remaining payment obligation shall remain unchanged.',
      ] },
      { p: 'The payment schedule shall simply be paused and extended by the duration of the suspension.' },
      { p: '12.7 Resumption of payments and return of motorcycle. Each suspension may last up to six (6) months. The Buyer may resume at any time within that period by notifying the Seller in writing. Upon resumption:' },
      { ul: [
        'The Seller shall return the motorcycle, keys, and accessories within three (3) business days.',
        'The Buyer shall resume payments beginning with the next unpaid installment.',
        'Any installments that were already overdue when the suspension began, any late fees accrued before it, and the registration and insurance costs under clause 12.3 shall be paid together with the first payment after resuming.',
        'All previously completed payments shall remain credited.',
        'The remaining payment schedule shall continue without additional interest, penalties, or restart fees.',
        'The Buyer shall retain the right to make additional payments or settle the remaining balance early under the original early-payment provisions.',
      ] },
      { p: 'The motorcycle shall be returned in substantially the same condition as when surrendered, allowing for any pre-existing condition or deterioration not caused by the Buyer.' },
      { p: '12.8 If the Buyer does not resume within six (6) months. If six (6) months pass from the start of a suspension and the Buyer has not resumed, and the Seller has not agreed in writing to extend it, the Seller may, without further notice, cancel this agreement and sell or otherwise dispose of the motorcycle. In that case, clause 11 applies to the payments already made: everything the Buyer has paid is kept by the Seller as rent for the use of the motorcycle and compensation for its depreciation. Any extension beyond six (6) months is at the Seller’s discretion.' },
      { p: '12.9 No waiver of existing obligations. Any unpaid installments, late fees, traffic violations, or other obligations arising before the suspension shall remain subject to the original agreement unless expressly waived in writing by the Seller, and are payable as set out in clause 12.7.' },
      { p: '12.10 Good-faith arrangement. Both parties acknowledge that this provision is intended to provide the Buyer with a reasonable opportunity to overcome temporary financial difficulties without immediately losing the motorcycle or payments already made. The Seller agrees to administer this arrangement in good faith, while the Buyer agrees to communicate honestly regarding his ability and intention to resume payments. This provision does not prevent either party from exercising rights available under applicable Philippine law.' },

      { h: '13. When fully paid.' },
      { p: 'Within 7 days of the last payment, the Seller signs a Deed of Absolute Sale and hands over the original OR/CR and the documents needed for transfer. The Buyer pays the transfer fees and handles the transfer.' },

      { h: '14. Signing.' },
      { p: 'Both parties agree that this agreement may be signed electronically, and that their electronic signatures are valid and binding under Republic Act No. 8792 (Electronic Commerce Act of 2000), with the same effect as handwritten signatures. The signed electronic record, including each party’s signature, the time of signing and the fingerprint of the signed text, is the original of this agreement. Each party may download a copy of it.' },

      { h: '15. General.' },
      { p: 'This is the whole agreement between the parties. Changes must be in writing and signed by both. Philippine law applies, and any case is filed in the courts of ' + v(d.venue, 'city') + '.' },

      { p: 'Agreement version ' + VERSION + '.' },
    ];
  }

  /** Canonical plain text of the agreement; this is what gets fingerprinted when signing. */
  function toText(details, buyer) {
    return blocks(details, buyer).map(function (b) {
      if (b.title) return b.title;
      if (b.h) return '\n' + b.h;
      if (b.ul) return b.ul.map(function (li) { return '- ' + li; }).join('\n');
      return b.p;
    }).join('\n') + '\n';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Placeholders like [color] are highlighted so it's obvious what still needs filling in. */
  function inline(s) {
    return esc(s).replace(/\[[^\]]+\]/g, function (m) { return '<span class="blank">' + m + '</span>'; })
      .replace(/^(\d+\.\d+ [^.]+\.)/, '<strong>$1</strong>');
  }

  function html(details, buyer) {
    return blocks(details, buyer).map(function (b) {
      if (b.title) return '<h3 class="doc-title">' + esc(b.title) + '</h3>';
      if (b.h) return '<h4>' + esc(b.h) + '</h4>';
      if (b.ul) return '<ul>' + b.ul.map(function (li) { return '<li>' + inline(li) + '</li>'; }).join('') + '</ul>';
      return '<p>' + inline(b.p) + '</p>';
    }).join('');
  }

  /** Renders a stored plain-text snapshot (used if the template has changed since signing). */
  function textToHtml(text) {
    var out = [];
    var list = [];
    function flush() { if (list.length) { out.push('<ul>' + list.join('') + '</ul>'); list = []; } }
    String(text || '').split('\n').forEach(function (line, i) {
      if (!line.trim()) return;
      if (line.indexOf('- ') === 0) { list.push('<li>' + esc(line.slice(2)) + '</li>'); return; }
      flush();
      if (i === 0) out.push('<h3 class="doc-title">' + esc(line) + '</h3>');
      else if (/^\d+\. /.test(line)) out.push('<h4>' + esc(line) + '</h4>');
      else out.push('<p>' + inline(line) + '</p>');
    });
    flush();
    return out.join('');
  }

  return {
    VERSION: VERSION,
    html: html,
    textToHtml: textToHtml,
    DEAL: DEAL,
    DETAIL_FIELDS: DETAIL_FIELDS,
    BUYER_FIELDS: BUYER_FIELDS,
    ORCR: ORCR,
    blocks: blocks,
    toText: toText,
    missingDetails: missingDetails,
    missingBuyer: missingBuyer,
    longDate: longDate,
  };
});
