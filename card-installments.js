/**
 * Installment prices, worked out from our regular (straight payment) price.
 * Card installments go through Lazada: the regular price + 10% (our Lazada price), plus the bank's
 * fee for the term. SPayLater and BillEase pay the regular price + 1%; the provider sets the
 * monthly amount and its own interest at checkout. Straight card payments pay the regular price.
 */
(function () {
    // Seller-paid Lazada installment fees (% of price) by bank and term in months.
    const BANKS = [
        { name: 'BDO', fees: { 3: 2.81, 6: 5.10, 9: 10.20, 12: 10.20, 18: 17.85, 24: 17.85 } },
        { name: 'BPI', fees: { 3: 2.24, 6: 4.59, 9: 7.65, 12: 8.67, 18: 11.22, 24: 18.36 } },
        { name: 'HSBC', fees: { 3: 2.04, 6: 4.08, 12: 8.67, 24: 10.20 } },
        { name: 'UnionBank', fees: { 3: 2.04, 6: 4.59, 12: 9.18, 24: 12.24, 36: 16.32 } }
    ];
    // Every bank offers 12 months, so the headline compares like with like.
    const HEADLINE_MONTHS = 12;
    // Used prices are the Good price; Excellent adds this (same as script.js).
    const EXCELLENT_EXTRA = 1000;
    const LATER_MARKUP_PCT = 1;

    const METHODS = [
        {
            id: 'credit_card',
            label: 'Credit Card',
            logos: [{ file: 'visa.svg', w: 1000, h: 324 }, { file: 'mastercard.svg', w: 131, h: 80 }]
        },
        { id: 'spaylater', label: 'SPayLater', logos: [{ file: 'spaylater.png', w: 480, h: 104 }] },
        { id: 'billease', label: 'BillEase', logos: [{ file: 'billease.png', w: 390, h: 83 }] }
    ];
    const DEFAULT_METHOD = 'credit_card';

    let selectedBank = null;

    function formatPeso(amount) {
        return '₱' + amount.toLocaleString('en-PH');
    }

    /** The bank bills total ÷ months to the centavo, so show centavos unless it divides evenly. */
    function formatMonthly(amount) {
        if (Number.isInteger(amount)) return formatPeso(amount);
        return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /** Regular price + 10%, rounded up to the next ₱xx90. */
    function lazadaPrice(cash) {
        return Math.ceil((cash * 11 / 10 + 10) / 100) * 100 - 10;
    }

    /** Lazada price plus the bank fee, rounded up to the next ₱xx90. */
    function installmentTotal(cash, feePct) {
        const raw = lazadaPrice(cash) * (1 + feePct / 100);
        return Math.ceil((raw + 10) / 100) * 100 - 10;
    }

    /** SPayLater / BillEase price: regular price + 1%, rounded up to the next ₱xx90. */
    function laterPrice(cash) {
        // Whole-peso integer maths, so a price landing exactly on ₱xx90 isn't pushed up by float error.
        return Math.ceil((cash * (100 + LATER_MARKUP_PCT) + 1000) / 10000) * 100 - 10;
    }

    /** How much more the installment total is than the regular price, e.g. "12.5%". */
    function formatRate(total, cash) {
        return (Math.round((total / cash - 1) * 1000) / 10) + '%';
    }

    function monthlyAmount(total, months) {
        return Math.round(total * 100 / months) / 100;
    }

    function headlinePlan(cash) {
        return BANKS.reduce(function (best, bank) {
            const fee = bank.fees[HEADLINE_MONTHS];
            if (fee == null) return best;
            const monthly = monthlyAmount(installmentTotal(cash, fee), HEADLINE_MONTHS);
            return !best || monthly < best.monthly ? { bank: bank, monthly: monthly } : best;
        }, null);
    }

    function bankLogoUrl(bank) {
        return '/images/banks/bank-' + bank.name.toLowerCase() + '.png';
    }

    function createBankPicker(pressedBank, onPick) {
        const logos = document.createElement('div');
        logos.className = 'card-inst-banks';
        BANKS.forEach(function (bank) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-inst-bank';
            btn.setAttribute('aria-pressed', bank === pressedBank ? 'true' : 'false');
            btn.setAttribute('aria-label', bank.name + ' installment plans');
            const img = document.createElement('img');
            img.src = bankLogoUrl(bank);
            img.alt = '';
            img.width = 420;
            img.height = 136;
            btn.appendChild(img);
            btn.addEventListener('click', function () {
                onPick(bank);
            });
            logos.appendChild(btn);
        });
        return logos;
    }

    function methodById(id) {
        return METHODS.find(function (m) { return m.id === id; }) || METHODS[0];
    }

    function createMethodPicker(selectedId, onPick) {
        const wrap = document.createElement('div');
        wrap.className = 'card-inst-methods';
        wrap.setAttribute('role', 'tablist');
        wrap.setAttribute('aria-label', 'Payment option');
        METHODS.forEach(function (method) {
            const isOn = method.id === selectedId;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-inst-method' + (isOn ? ' is-selected' : '');
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', String(isOn));

            const logos = document.createElement('span');
            logos.className = 'card-inst-method-logos';
            method.logos.forEach(function (logo) {
                const img = document.createElement('img');
                img.src = '/images/payments/' + logo.file;
                img.alt = '';
                img.width = logo.w;
                img.height = logo.h;
                logos.appendChild(img);
            });
            const label = document.createElement('span');
            label.className = 'card-inst-method-label';
            label.textContent = method.label;

            btn.appendChild(logos);
            btn.appendChild(label);
            btn.addEventListener('click', function () {
                if (!isOn) onPick(method.id);
            });
            wrap.appendChild(btn);
        });
        return wrap;
    }

    function createLaterSummary(cash, method) {
        const table = document.createElement('div');
        table.className = 'card-inst-table card-inst-table--later';

        const regular = document.createElement('div');
        regular.className = 'card-inst-row';
        const regularLabel = document.createElement('div');
        regularLabel.textContent = 'Regular price';
        const regularAmount = document.createElement('div');
        regularAmount.textContent = formatPeso(cash);
        regular.appendChild(regularLabel);
        regular.appendChild(regularAmount);

        const later = document.createElement('div');
        later.className = 'card-inst-row';
        const laterLabel = document.createElement('div');
        laterLabel.className = 'card-inst-term';
        laterLabel.appendChild(document.createTextNode(method.label + ' price '));
        const rate = document.createElement('span');
        rate.className = 'card-inst-rate';
        rate.textContent = '+' + LATER_MARKUP_PCT + '%';
        laterLabel.appendChild(rate);
        const laterAmount = document.createElement('div');
        laterAmount.className = 'card-inst-monthly';
        laterAmount.textContent = formatPeso(laterPrice(cash));
        later.appendChild(laterLabel);
        later.appendChild(laterAmount);

        table.appendChild(regular);
        table.appendChild(later);
        return table;
    }

    function createPlansTable(cash, bank) {
        const table = document.createElement('div');
        table.className = 'card-inst-table';

        const head = document.createElement('div');
        head.className = 'card-inst-row card-inst-row--head';
        ['Term', 'Monthly', 'Total'].forEach(function (label) {
            const cell = document.createElement('div');
            cell.textContent = label;
            head.appendChild(cell);
        });
        table.appendChild(head);

        Object.keys(bank.fees)
            .map(Number)
            .sort(function (a, b) { return a - b; })
            .forEach(function (months) {
                const total = installmentTotal(cash, bank.fees[months]);
                const row = document.createElement('div');
                row.className = 'card-inst-row';

                const term = document.createElement('div');
                term.className = 'card-inst-term';
                term.appendChild(document.createTextNode(months + ' months '));
                const rate = document.createElement('span');
                rate.className = 'card-inst-rate';
                rate.textContent = 'at ' + formatRate(total, cash);
                term.appendChild(rate);

                const monthly = document.createElement('div');
                monthly.className = 'card-inst-monthly';
                monthly.textContent = formatMonthly(monthlyAmount(total, months));
                const perMonth = document.createElement('span');
                perMonth.textContent = '/mo';
                monthly.appendChild(perMonth);

                const totalEl = document.createElement('div');
                totalEl.textContent = formatPeso(total);

                row.appendChild(term);
                row.appendChild(monthly);
                row.appendChild(totalEl);
                table.appendChild(row);
            });
        return table;
    }

    // ---- Per-model popup: every variation's monthly, tap a row for all terms ----

    let modal = null;

    function closeModal() {
        if (!modal || modal.overlay.hidden) return;
        modal.overlay.hidden = true;
        modal.overlay.setAttribute('aria-hidden', 'true');
        // It can open on top of the stock popup, which still needs the page locked.
        if (!document.querySelector('.stock-overlay:not([hidden])')) document.body.style.overflow = '';
        if (modal.trigger) {
            modal.trigger.setAttribute('aria-expanded', 'false');
            modal.trigger.focus();
            modal.trigger = null;
        }
    }

    function ensureModal() {
        if (modal) return modal;
        const overlay = document.createElement('div');
        overlay.className = 'stock-overlay';
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');

        const dialog = document.createElement('div');
        dialog.className = 'stock-modal card-inst-modal';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'card-inst-modal-title');

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'stock-modal-close';
        close.setAttribute('aria-label', 'Close');
        close.textContent = 'Close';

        const header = document.createElement('div');
        header.className = 'stock-modal-header';
        const title = document.createElement('h2');
        title.className = 'stock-modal-title';
        title.id = 'card-inst-modal-title';
        header.appendChild(title);

        const body = document.createElement('div');
        body.className = 'stock-modal-body';

        dialog.appendChild(close);
        dialog.appendChild(header);
        dialog.appendChild(body);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
        close.addEventListener('click', closeModal);
        // Capture phase, so Escape closes only this popup and not the stock popup under it.
        window.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' || overlay.hidden) return;
            e.stopPropagation();
            closeModal();
        }, true);

        modal = { overlay: overlay, close: close, title: title, body: body, trigger: null };
        return modal;
    }

    function pricedVariants(variants) {
        return (variants || []).filter(function (v) {
            return typeof v.price === 'number' && v.price > 0;
        });
    }

    function createConditionTag(condition) {
        const tag = document.createElement('span');
        const isNew = condition === 'New';
        tag.className = 'tag ' + (isNew ? 'tag--condition-new' : 'tag--condition-used');
        tag.textContent = isNew ? 'New' : 'Used';
        return tag;
    }

    const GRADES = [
        { id: 'good', label: 'Good', className: 'tag--good', extra: 0 },
        { id: 'excellent', label: 'Excellent', className: 'tag--excellent', extra: EXCELLENT_EXTRA }
    ];

    /** Used prices are the Good price; the chosen grade may add to it. */
    function variantCash(variant, grade) {
        if (variant.condition === 'New') return variant.price;
        return grade === 'excellent' ? variant.price + EXCELLENT_EXTRA : variant.price;
    }

    function createGradeSwitch(goodPrice, selected, onPick) {
        const wrap = document.createElement('div');
        wrap.className = 'card-inst-grade-switch';
        wrap.setAttribute('role', 'radiogroup');
        wrap.setAttribute('aria-label', 'Condition');

        const label = document.createElement('span');
        label.className = 'card-inst-note';
        label.textContent = 'Regular price';
        wrap.appendChild(label);

        GRADES.forEach(function (grade) {
            const isOn = grade.id === selected;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-inst-grade' + (isOn ? ' is-selected' : '');
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', String(isOn));
            const tag = document.createElement('span');
            tag.className = 'tag ' + grade.className;
            tag.textContent = grade.label;
            const price = document.createElement('strong');
            price.textContent = formatPeso(goodPrice + grade.extra);
            btn.appendChild(tag);
            btn.appendChild(price);
            btn.addEventListener('click', function () {
                if (!isOn) onPick(grade.id);
            });
            wrap.appendChild(btn);
        });
        return wrap;
    }

    function renderModelBody(variants, defaultBank, state) {
        const bank = selectedBank || defaultBank;
        const body = modal.body;
        const scrollTop = body.scrollTop;
        body.innerHTML = '';

        const view = document.createElement('div');
        view.className = 'card-inst-model-view';

        const method = methodById(state.method);
        const isCard = method.id === 'credit_card';

        const pickerLabel = document.createElement('p');
        pickerLabel.className = 'card-inst-title';
        pickerLabel.textContent = 'Choose payment option';
        view.appendChild(pickerLabel);
        view.appendChild(createMethodPicker(method.id, function (picked) {
            state.method = picked;
            renderModelBody(variants, defaultBank, state);
        }));

        if (isCard) {
            const bankRow = document.createElement('div');
            bankRow.className = 'card-inst-bank-row';
            const bankLabel = document.createElement('span');
            bankLabel.className = 'card-inst-note';
            bankLabel.textContent = 'Bank';
            bankRow.appendChild(bankLabel);
            bankRow.appendChild(createBankPicker(bank, function (picked) {
                selectedBank = picked;
                renderModelBody(variants, defaultBank, state);
            }));
            view.appendChild(bankRow);
        }

        const list = document.createElement('div');
        list.className = 'card-inst-variants';
        const grade = state.grade || 'good';
        variants.forEach(function (variant, index) {
            const isOpen = state.openIndex === index;
            const cash = variantCash(variant, grade);
            const isUsed = variant.condition !== 'New';

            const item = document.createElement('div');
            item.className = 'card-inst-variant' + (isOpen ? ' is-open' : '');

            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'card-inst-variant-row';
            row.setAttribute('aria-expanded', String(isOpen));

            const name = document.createElement('span');
            name.className = 'card-inst-variant-name';
            name.appendChild(document.createTextNode(variant.storage + ' '));
            name.appendChild(createConditionTag(variant.condition));

            const info = document.createElement('span');
            info.className = 'card-inst-variant-info';
            info.appendChild(name);
            if (isOpen && !isUsed && isCard) {
                const regular = document.createElement('span');
                regular.className = 'card-inst-note';
                regular.appendChild(document.createTextNode('Regular price '));
                const strong = document.createElement('strong');
                strong.textContent = formatPeso(variant.price);
                regular.appendChild(strong);
                info.appendChild(regular);
            }

            const monthly = document.createElement('span');
            monthly.className = 'card-inst-variant-monthly';
            if (isUsed && grade === 'good') {
                const from = document.createElement('em');
                from.textContent = 'from ';
                monthly.appendChild(from);
            }
            const amount = document.createElement('strong');
            if (isCard) {
                const total = installmentTotal(cash, bank.fees[HEADLINE_MONTHS]);
                amount.textContent = formatMonthly(monthlyAmount(total, HEADLINE_MONTHS));
                monthly.appendChild(amount);
                monthly.appendChild(document.createTextNode('/mo × ' + HEADLINE_MONTHS));
            } else {
                amount.textContent = formatPeso(laterPrice(cash));
                monthly.appendChild(amount);
                monthly.appendChild(document.createTextNode('\u00a0total'));
            }

            row.appendChild(info);
            row.appendChild(monthly);
            row.addEventListener('click', function () {
                state.openIndex = isOpen ? null : index;
                renderModelBody(variants, defaultBank, state);
            });
            item.appendChild(row);

            if (isOpen) {
                const plans = document.createElement('div');
                plans.className = 'card-inst-variant-plans';
                if (isUsed) {
                    plans.appendChild(createGradeSwitch(variant.price, grade, function (picked) {
                        state.grade = picked;
                        renderModelBody(variants, defaultBank, state);
                    }));
                }
                const note = document.createElement('p');
                note.className = 'card-inst-note';
                if (isCard) {
                    plans.appendChild(createPlansTable(cash, bank));
                    note.textContent = 'Straight (one-time) credit card payments follow our regular pricing.';
                } else {
                    plans.appendChild(createLaterSummary(cash, method));
                    note.textContent = method.label + ' shows your monthly amount and terms, plus any interest it adds, when you pay.';
                }
                plans.appendChild(note);
                item.appendChild(plans);
            }
            list.appendChild(item);
        });
        view.appendChild(list);

        body.appendChild(view);
        body.scrollTop = scrollTop;
    }

    /** "Installments from ₱X" for a model card (cheapest variation's SPayLater / BillEase price); opens the popup. */
    function createModelLink(modelName, variants) {
        const priced = pricedVariants(variants);
        let cheapest = null;
        priced.forEach(function (v) {
            const plan = headlinePlan(v.price);
            if (plan && (!cheapest || plan.monthly < cheapest.monthly)) cheapest = plan;
        });
        if (!cheapest) return null;
        const lowestTotal = Math.min.apply(null, priced.map(function (v) { return laterPrice(v.price); }));

        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'card-inst-model-link';
        link.setAttribute('aria-haspopup', 'dialog');
        link.setAttribute('aria-expanded', 'false');

        const label = document.createElement('span');
        label.className = 'card-inst-model-link__label';
        label.textContent = 'Installments from';
        const amountLine = document.createElement('span');
        amountLine.className = 'card-inst-model-link__amount';
        const amount = document.createElement('strong');
        amount.textContent = formatPeso(lowestTotal);
        amountLine.appendChild(amount);
        link.appendChild(label);
        link.appendChild(amountLine);

        link.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const m = ensureModal();
            m.trigger = link;
            m.title.textContent = modelName + ' Installments';
            m.body.scrollTop = 0;
            renderModelBody(priced, cheapest.bank, { openIndex: null, method: DEFAULT_METHOD });
            m.overlay.hidden = false;
            m.overlay.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            link.setAttribute('aria-expanded', 'true');
            m.close.focus();
        });
        return link;
    }

    window.CARD_INSTALLMENTS = { createModelLink: createModelLink };
})();
