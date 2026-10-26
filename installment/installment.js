(function () {
    const DATA_URL = '/installment/data.json';
    const INVENTORY_URL = '/api/inventory';
    const PRICES_URL = '/api/prices';
    const GRADE_ORDER = ['New', 'Excellent', 'Good', 'Acceptable', 'MDM', 'Used', 'Issue'];
    const GRADE_TAG_CLASS = {
        Excellent: 'tag--excellent',
        Good: 'tag--good',
        Acceptable: 'tag--fair',
        MDM: 'tag--mdm',
        Issue: 'tag--issue'
    };
    const SPEC_LABEL = { phones: 'Storage', watches: 'Size', laptops: 'Specs' };
    const STATUS_RANK = { stock: 0, incoming: 1, restock: 2 };
    const STOCK_ONLY_CATEGORIES = ['laptops'];

    const listEl = document.getElementById('pricing-list');
    const emptyEl = document.getElementById('pricing-empty-state');
    const loadingEl = document.getElementById('pricing-loading');
    const tabsEl = document.getElementById('inst-tabs');
    const overlayEl = document.getElementById('plans-overlay');
    const modalTitleEl = document.getElementById('plans-modal-title');
    const modalBodyEl = document.getElementById('plans-modal-body');
    const modalCloseEl = overlayEl.querySelector('.stock-modal-close');
    const softOverlayEl = document.getElementById('soft-unlocked-overlay');

    let banks = [];
    let selectedBank = null;
    let fromFee = 0;
    let lastTrigger = null;
    let softLastFocus = null;
    const plansState = { openUnit: null, othersOpen: false };
    const RESERVE_NOTE = 'Units below will take 3–4 weeks to arrive after ordering.';

    function formatPeso(amount) {
        return '₱' + amount.toLocaleString('en-PH');
    }

    /** Price plus the bank fee, rounded up to the next ₱xx90. */
    function installmentTotal(price, feePct) {
        const raw = price * (1 + feePct / 100);
        return Math.ceil((raw + 10) / 100) * 100 - 10;
    }

    function lowestFee() {
        let min = Infinity;
        banks.forEach(function (bank) {
            Object.values(bank.fees).forEach(function (fee) {
                if (fee < min) min = fee;
            });
        });
        return min;
    }

    function storageRank(spec) {
        const m = String(spec || '').match(/(\d+)\s*(GB|TB)\s*$/i);
        if (!m) return 0;
        return Number(m[1]) * (m[2].toUpperCase() === 'TB' ? 1024 : 1);
    }

    function gradeRank(grade) {
        const i = GRADE_ORDER.indexOf(grade);
        return i === -1 ? 99 : i;
    }

    function uniq(list) {
        return list.filter(function (v, i) { return list.indexOf(v) === i; });
    }

    // ---- Stock -------------------------------------------------------------

    function liveUnitGrade(unit) {
        if (unit.hasIssue) return { grade: 'Issue', ungraded: false };
        const condition = String(unit.condition || '');
        if (/^new/i.test(condition)) return { grade: 'New', ungraded: false };
        if (/mdm/i.test(condition)) return { grade: 'MDM', ungraded: false };
        const g = String(unit.grade || '');
        if (/excellent/i.test(g)) return { grade: 'Excellent', ungraded: false };
        if (/good/i.test(g)) return { grade: 'Good', ungraded: false };
        if (/fair|acceptable/i.test(g)) return { grade: 'Acceptable', ungraded: false };
        // Incoming used units are graded on arrival and priced at Good until then.
        return { grade: 'Good', ungraded: true };
    }

    function parseAvailability(label) {
        const text = String(label || '').trim();
        if (text === 'In Stock') return { type: 'stock', eta: null };
        if (/arriving/i.test(text)) {
            const eta = text
                .replace(/^Arriving in\s*/i, '')
                .replace(/–/g, '-')
                .replace(/\bwk\b\.?/gi, 'weeks')
                .trim();
            return { type: 'incoming', eta: eta };
        }
        return null;
    }

    function buildLiveUnitsByModel(list) {
        const byModel = new Map();
        list.forEach(function (unit) {
            if (!unit || !unit.model) return;
            const status = parseAvailability(unit.availability);
            if (!status) return;
            const gradeInfo = liveUnitGrade(unit);
            const entry = {
                spec: String(unit.storage || '').trim().toUpperCase().replace(/\s+/g, ''),
                soft: /soft/i.test(String(unit.condition || '')),
                grade: gradeInfo.grade,
                ungraded: gradeInfo.ungraded,
                color: unit.color || '',
                status: status.type,
                eta: status.eta,
                qty: 1
            };
            const key = [entry.spec, entry.soft, entry.grade, entry.ungraded, entry.color, entry.status, entry.eta].join('|');
            if (!byModel.has(unit.model)) byModel.set(unit.model, new Map());
            const units = byModel.get(unit.model);
            if (units.has(key)) units.get(key).qty += 1;
            else units.set(key, entry);
        });
        const out = new Map();
        byModel.forEach(function (units, model) {
            out.set(model, Array.from(units.values()));
        });
        return out;
    }

    function sheetUnits(model) {
        return (model.units || []).map(function (u) {
            return {
                spec: u.spec,
                soft: u.soft,
                grade: u.grade,
                ungraded: false,
                color: u.color,
                status: 'stock',
                eta: null,
                qty: u.qty
            };
        });
    }

    function sortUnits(units) {
        units.sort(function (a, b) {
            return (
                STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
                (a.grade === 'New' ? 0 : 1) - (b.grade === 'New' ? 0 : 1) ||
                storageRank(a.spec) - storageRank(b.spec) ||
                String(a.spec).localeCompare(String(b.spec)) ||
                gradeRank(a.grade) - gradeRank(b.grade) ||
                String(a.color).localeCompare(String(b.color))
            );
        });
        return units;
    }

    function unitsForOption(model, option) {
        return model.stockUnits.filter(function (u) {
            return u.spec === option.spec && u.soft === option.soft && u.grade === option.grade;
        });
    }

    /** Best availability across an option's units: in stock > incoming > restocking. */
    function optionStatus(model, option) {
        const units = unitsForOption(model, option);
        const inStock = units.filter(function (u) { return u.status === 'stock'; });
        if (inStock.length) {
            return {
                type: 'stock',
                qty: inStock.reduce(function (n, u) { return n + u.qty; }, 0),
                colors: uniq(inStock.map(function (u) { return u.color; }).filter(Boolean)),
                ungraded: false
            };
        }
        const incoming = units.filter(function (u) { return u.status === 'incoming'; });
        if (incoming.length) {
            return {
                type: 'incoming',
                eta: incoming[0].eta,
                qty: incoming.reduce(function (n, u) { return n + u.qty; }, 0),
                colors: uniq(incoming.map(function (u) { return u.color; }).filter(Boolean)),
                ungraded: incoming.some(function (u) { return u.ungraded; })
            };
        }
        return { type: 'restock', qty: 0, colors: [], ungraded: false };
    }

    /**
     * Soft unlocked and Issue options only show when we actually have (or are getting) that unit.
     * Categories in STOCK_ONLY_CATEGORIES (laptops) apply that to every option.
     */
    function prepareModel(model, categoryKey, liveUnits) {
        model.stockUnits = sortUnits(liveUnits || sheetUnits(model));
        const categoryStockOnly = STOCK_ONLY_CATEGORIES.indexOf(categoryKey) !== -1;
        model.visibleOptions = model.options.filter(function (option) {
            const stockOnly = categoryStockOnly || option.soft || option.grade === 'Issue';
            return !stockOnly || optionStatus(model, option).type !== 'restock';
        });
        // Ungraded incoming units could land as any used grade, so they don't cover a grade here.
        model.reserveOptions = model.visibleOptions.filter(function (option) {
            if (option.grade === 'Issue') return false;
            return !unitsForOption(model, option).some(function (u) { return !u.ungraded; });
        });
        return model;
    }

    // ---- Variants without a Lazada listing -----------------------------------

    /** Straight-payment price plus 10%, rounded up to the next ₱xx90. */
    function cashToListingPrice(cash) {
        return Math.ceil((cash * 11 / 10 + 10) / 100) * 100 - 10;
    }

    /** Same adjustments as the main price list, where Grist's Used price is the Good price. */
    function cashPriceFor(base, grade, soft) {
        if (grade === 'Issue') return null;
        let price = base;
        if (grade === 'Excellent') price += 1000;
        if (grade === 'MDM') price -= 3000;
        if (soft) price -= 4000;
        return price;
    }

    function normalizeSpec(spec) {
        return String(spec || '').trim().toUpperCase().replace(/\s+/g, '');
    }

    /** model → { 'SPEC|New' / 'SPEC|Used': straight-payment price } from Grist codes. */
    function buildCashPricesByModel(list) {
        const priceByCode = {};
        list.forEach(function (row) {
            const code = String(row.code == null ? '' : row.code).trim().toUpperCase();
            const price = Number(row.price);
            if (!code || !(price > 0)) return;
            priceByCode[code] = price;
            if (/^\d+$/.test(code)) priceByCode['B' + code] = price;
        });
        const byModel = new Map();
        (window.PIXEL_PRICE_CODES || []).forEach(function (row) {
            const code = String(row.code || '').trim().toUpperCase();
            const price = priceByCode[code] || priceByCode[code.replace(/^B/, '')];
            if (!code || !price) return;
            if (!byModel.has(row.model)) byModel.set(row.model, {});
            byModel.get(row.model)[normalizeSpec(row.storage) + '|' + row.condition] = price;
        });
        return byModel;
    }

    function modelOrder(modelName) {
        const codes = window.PIXEL_PRICE_CODES || [];
        for (let i = codes.length - 1; i >= 0; i--) {
            if (codes[i].model === modelName) return codes.length - i;
        }
        return codes.length + 1;
    }

    /**
     * Prices every Pixel variant at the straight-payment price + 10% (our regular Lazada price),
     * adding variants and models the Lazada sheet doesn't have: New / Good / Excellent for every
     * priced storage, plus whatever variant an in-stock or incoming unit needs. Issue units have
     * no straight-payment price, so they keep the Lazada sheet price.
     */
    function applyCashPricing(category, cashByModel, liveByModel) {
        cashByModel.forEach(function (cash, modelName) {
            let model = category.models.find(function (m) { return m.model === modelName; });
            if (!model) {
                model = { model: modelName, options: [], units: [] };
                category.models.push(model);
            }
            const wanted = [];
            Object.keys(cash).forEach(function (key) {
                const parts = key.split('|');
                if (parts[1] === 'New') {
                    wanted.push({ spec: parts[0], soft: false, grade: 'New' });
                } else {
                    wanted.push({ spec: parts[0], soft: false, grade: 'Excellent' });
                    wanted.push({ spec: parts[0], soft: false, grade: 'Good' });
                }
            });
            ((liveByModel && liveByModel.get(modelName)) || []).forEach(function (unit) {
                wanted.push({ spec: unit.spec, soft: unit.soft, grade: unit.grade });
            });

            function listingPrice(o) {
                const base = cash[o.spec + '|' + (o.grade === 'New' ? 'New' : 'Used')];
                const cashPrice = base ? cashPriceFor(base, o.grade, o.soft) : null;
                return cashPrice ? cashToListingPrice(cashPrice) : null;
            }

            model.options.forEach(function (o) {
                const price = listingPrice(o);
                if (price) o.price = price;
            });

            let added = false;
            wanted.forEach(function (w) {
                const exists = model.options.some(function (o) {
                    return o.spec === w.spec && o.soft === w.soft && o.grade === w.grade;
                });
                if (exists) return;
                const price = listingPrice(w);
                if (!price) return;
                model.options.push({ spec: w.spec, soft: w.soft, grade: w.grade, price: price });
                added = true;
            });
            if (added) {
                model.options.sort(function (a, b) {
                    return (
                        storageRank(a.spec) - storageRank(b.spec) ||
                        Number(a.soft) - Number(b.soft) ||
                        gradeRank(a.grade) - gradeRank(b.grade)
                    );
                });
            }
        });
        category.models.sort(function (a, b) {
            return modelOrder(a.model) - modelOrder(b.model);
        });
    }

    function headlineOption(model) {
        const regular = model.visibleOptions.filter(function (o) {
            return o.grade !== 'Issue' && o.grade !== 'MDM';
        });
        const pool = regular.length ? regular : model.visibleOptions;
        return pool.reduce(function (best, o) {
            return !best || o.price < best.price ? o : best;
        }, null);
    }

    function modelHasStock(model) {
        return model.stockUnits.length > 0;
    }

    // ---- Shared bits ---------------------------------------------------------

    function createTag(className, text, title) {
        const tag = document.createElement('span');
        tag.className = 'tag ' + className;
        tag.textContent = text;
        if (title) tag.title = title;
        return tag;
    }

    function createConditionTags(option, opts) {
        const wrap = document.createElement('span');
        wrap.className = 'inst-tag-group';
        const isNew = option.grade === 'New';
        wrap.appendChild(createTag(isNew ? 'tag--condition-new' : 'tag--condition-used', isNew ? 'New' : 'Used'));
        if (GRADE_TAG_CLASS[option.grade] && !(opts && opts.ungraded)) {
            wrap.appendChild(createTag(GRADE_TAG_CLASS[option.grade], option.grade));
        }
        if (option.soft) wrap.appendChild(createSoftBadge('Soft'));
        return wrap;
    }

    function createSoftBadge(text) {
        const badge = document.createElement('span');
        badge.className = 'tag tag--soft tag--soft-with-help';
        const label = document.createElement('span');
        label.textContent = text;
        badge.appendChild(label);

        const help = document.createElement('button');
        help.type = 'button';
        help.className = 'tag-help-trigger';
        help.setAttribute('aria-label', 'What does Soft unlocked mean?');
        help.textContent = '?';
        help.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openSoftOverlay();
        });
        help.addEventListener('keydown', function (e) {
            e.stopPropagation();
        });
        badge.appendChild(help);
        return badge;
    }

    function createStatusPill(status) {
        const wrap = document.createElement('span');
        wrap.className = 'inventory-unit-status';
        const pill = document.createElement('span');
        if (status.type === 'stock') {
            pill.className = 'status-pill status-pill--stock';
            pill.textContent = 'In Stock';
        } else if (status.type === 'incoming') {
            pill.className = 'status-pill status-pill--incoming';
            pill.textContent = 'Incoming';
        } else {
            pill.className = 'status-pill status-pill--restock';
            pill.textContent = 'Restocking soon';
        }
        wrap.appendChild(pill);
        if (status.eta) {
            const eta = document.createElement('span');
            eta.className = 'status-pill-eta';
            eta.textContent = status.eta;
            wrap.appendChild(eta);
        }
        return wrap;
    }

    function getModelImageUrl(modelName) {
        const catalog = window.PIXEL_CATALOG;
        if (!catalog || !catalog.MODEL_IMAGE_FILES[modelName]) return null;
        return catalog.getModelImageUrl(modelName);
    }

    // ---- Cards ---------------------------------------------------------------

    function createModelCard(model, category) {
        const groupEl = document.createElement('section');
        groupEl.className = 'model-group';

        const headerEl = document.createElement('div');
        headerEl.className = 'model-header inst-card-header';

        const imageUrl = getModelImageUrl(model.model);
        if (imageUrl) {
            const imageEl = document.createElement('img');
            imageEl.className = 'model-header__image inst-model-image';
            imageEl.src = imageUrl;
            imageEl.alt = '';
            imageEl.width = 44;
            imageEl.height = 44;
            imageEl.loading = 'lazy';
            imageEl.decoding = 'async';
            imageEl.addEventListener('error', function () {
                imageEl.remove();
            });
            headerEl.appendChild(imageEl);
        }

        const headerText = document.createElement('div');
        headerText.className = 'model-header-text';
        const title = document.createElement('h2');
        title.className = 'inst-model-title';
        title.textContent = model.model;
        headerText.appendChild(title);

        const actionsRow = document.createElement('div');
        actionsRow.className = 'model-header-actions-row';
        if (!modelHasStock(model) && category.key !== 'laptops') {
            const restock = document.createElement('span');
            restock.className = 'model-restock-badge';
            restock.textContent = 'Restocking soon';
            actionsRow.appendChild(restock);
        }
        if (actionsRow.childNodes.length) headerText.appendChild(actionsRow);
        headerEl.appendChild(headerText);

        const headline = headlineOption(model);
        const priceWrap = document.createElement('div');
        priceWrap.className = 'inst-price';
        const priceEl = document.createElement('div');
        priceEl.className = 'variant-price';
        const fromLabel = document.createElement('span');
        fromLabel.className = 'variant-price-from';
        fromLabel.textContent = 'from ';
        const amount = document.createElement('span');
        amount.className = 'variant-price-amount';
        amount.textContent = formatPeso(installmentTotal(headline.price, fromFee));
        priceEl.appendChild(fromLabel);
        priceEl.appendChild(amount);

        const plansBtn = document.createElement('button');
        plansBtn.type = 'button';
        plansBtn.className = 'inst-plans-link';
        plansBtn.textContent = 'View all plans';
        plansBtn.setAttribute('aria-haspopup', 'dialog');
        plansBtn.addEventListener('click', function () {
            openPlansView(model, category, plansBtn);
        });

        priceWrap.appendChild(priceEl);
        priceWrap.appendChild(plansBtn);
        headerEl.appendChild(priceWrap);

        groupEl.appendChild(headerEl);
        return groupEl;
    }

    function renderCategory(category) {
        listEl.innerHTML = '';
        const models = category ? category.models.filter(function (m) { return m.visibleOptions.length; }) : [];
        if (!models.length) {
            emptyEl.hidden = false;
            return;
        }
        emptyEl.hidden = true;
        const fragment = document.createDocumentFragment();
        models.forEach(function (model) {
            fragment.appendChild(createModelCard(model, category));
        });
        listEl.appendChild(fragment);
    }

    function renderTabs(categories) {
        tabsEl.innerHTML = '';
        const buttons = [];
        categories.forEach(function (category, index) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'inst-tab';
            btn.setAttribute('role', 'tab');
            btn.textContent = category.label;
            btn.addEventListener('click', function () {
                buttons.forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
                btn.setAttribute('aria-selected', 'true');
                renderCategory(category);
            });
            btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            buttons.push(btn);
            tabsEl.appendChild(btn);
        });
    }

    // ---- Plans view ----------------------------------------------------------

    function createPlansTable(price, bank) {
        const table = document.createElement('div');
        table.className = 'inst-plans-table';

        const header = document.createElement('div');
        header.className = 'inst-plans-row inst-plans-row--head';
        ['Term', 'Monthly', 'Total'].forEach(function (label) {
            const cell = document.createElement('div');
            cell.textContent = label;
            header.appendChild(cell);
        });
        table.appendChild(header);

        Object.keys(bank.fees)
            .map(Number)
            .sort(function (a, b) { return a - b; })
            .forEach(function (months) {
                const total = installmentTotal(price, bank.fees[String(months)]);
                const rowEl = document.createElement('div');
                rowEl.className = 'inst-plans-row';

                const term = document.createElement('div');
                term.className = 'inst-plans-term';
                term.textContent = months + ' months';

                const monthly = document.createElement('div');
                monthly.className = 'inst-plans-monthly';
                monthly.textContent = formatPeso(Math.ceil(total / months));
                const perMonth = document.createElement('span');
                perMonth.textContent = '/mo';
                monthly.appendChild(perMonth);

                const totalEl = document.createElement('div');
                totalEl.className = 'inst-plans-total';
                totalEl.textContent = formatPeso(total);

                rowEl.appendChild(term);
                rowEl.appendChild(monthly);
                rowEl.appendChild(totalEl);
                table.appendChild(rowEl);
            });
        return table;
    }

    /** options: [{ value, label }] */
    function createChoiceGroup(label, options, selected, onSelect, extraClass) {
        const group = document.createElement('div');
        group.className = 'inst-choice-group';

        const labelEl = document.createElement('p');
        labelEl.className = 'inst-choice-label';
        labelEl.textContent = label;
        group.appendChild(labelEl);

        const row = document.createElement('div');
        row.className = 'inst-choice-row';
        options.forEach(function (option) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'inst-choice' + (extraClass ? ' ' + extraClass : '');
            btn.setAttribute('aria-pressed', option.value === selected ? 'true' : 'false');
            btn.textContent = option.label;
            btn.addEventListener('click', function () {
                onSelect(option.value);
            });
            row.appendChild(btn);
        });
        group.appendChild(row);
        return group;
    }

    function cheapestRegular(options) {
        const regular = options.filter(function (o) { return o.grade !== 'Issue' && o.grade !== 'MDM'; });
        const pool = regular.length ? regular : options;
        return pool.reduce(function (best, o) { return !best || o.price < best.price ? o : best; }, null);
    }

    /** Snap a requested selection onto an option that exists, keeping as much of it as possible. */
    function resolveSelection(model, want) {
        const options = model.reserveOptions;
        const byGrade = options.filter(function (o) { return o.grade === want.grade; });
        if (!byGrade.length) return cheapestRegular(options);
        let bySpec = byGrade.filter(function (o) { return o.spec === want.spec; });
        if (!bySpec.length) {
            const factory = byGrade.filter(function (o) { return !o.soft; });
            const cheapest = cheapestRegular(factory.length ? factory : byGrade);
            bySpec = byGrade.filter(function (o) { return o.spec === cheapest.spec; });
        }
        return (
            bySpec.find(function (o) { return o.soft === want.soft; }) ||
            bySpec.find(function (o) { return !o.soft; }) ||
            bySpec[0]
        );
    }

    function addNote(parent, html) {
        const note = document.createElement('p');
        note.className = 'inst-modal-note';
        note.innerHTML = html;
        parent.appendChild(note);
    }

    function findOption(model, unit) {
        return model.visibleOptions.find(function (o) {
            return o.spec === unit.spec && o.soft === unit.soft && o.grade === unit.grade;
        }) || null;
    }

    function createColorCell(color) {
        const cell = document.createElement('span');
        cell.className = 'inventory-unit-color-col';
        if (!color) {
            cell.classList.add('inventory-unit-color-col--empty');
            cell.textContent = '—';
            return cell;
        }
        const catalog = window.PIXEL_CATALOG;
        if (catalog && catalog.getPixelColorHex) {
            const info = catalog.getPixelColorHex(color);
            const dot = document.createElement('span');
            dot.className = 'color-dot' + (info.light ? ' color-dot--light' : '');
            dot.style.backgroundColor = info.hex;
            dot.setAttribute('aria-hidden', 'true');
            cell.appendChild(dot);
        }
        const name = document.createElement('span');
        name.className = 'inventory-unit-color-name';
        name.textContent = color;
        cell.appendChild(name);
        return cell;
    }

    // Match Grist STORAGE Choice colors, same as the main price list.
    function createSpecCell(spec, categoryKey) {
        const cell = document.createElement('span');
        cell.className = 'inventory-unit-storage-col';
        if (categoryKey === 'laptops') {
            cell.classList.add('inst-stock-spec-text');
            cell.textContent = spec;
            return cell;
        }
        const key = spec.replace(/\s+/g, '').toUpperCase();
        const badge = document.createElement('span');
        badge.className = 'tag tag--storage';
        if (key === '64GB') badge.classList.add('tag--storage-64');
        else if (key === '128GB') badge.classList.add('tag--storage-128');
        else if (key === '256GB') badge.classList.add('tag--storage-256');
        else if (key === '512GB') badge.classList.add('tag--storage-512');
        else badge.classList.add('tag--storage-default');
        badge.textContent = spec;
        cell.appendChild(badge);
        return cell;
    }

    function createInquireLink() {
        const link = document.createElement('a');
        link.href = 'https://m.me/sulitzilla';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'inst-stock-inquire';
        link.textContent = 'Inquire';
        return link;
    }

    function bankLogoUrl(bank) {
        return '/installment/bank-' + bank.name.toLowerCase().replace(/\s+/g, '') + '.png';
    }

    function createBankButtons(onPick, pressedBank) {
        const strip = document.createElement('div');
        strip.className = 'inst-unit-banks';

        const label = document.createElement('p');
        label.className = 'inst-unit-banks__label';
        label.textContent = 'Choose your card:';
        strip.appendChild(label);
        strip.appendChild(createBankLogos(onPick, pressedBank));
        return strip;
    }

    function createBankLogos(onPick, pressedBank) {
        const logos = document.createElement('span');
        logos.className = 'inst-unit-banks__logos';
        banks.forEach(function (bank) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'inst-bank-btn';
            btn.setAttribute('aria-pressed', bank === pressedBank ? 'true' : 'false');
            btn.setAttribute('aria-label', bank.name + ' installment plans');
            const img = document.createElement('img');
            img.src = bankLogoUrl(bank);
            img.alt = '';
            img.width = 420;
            img.height = 136;
            btn.appendChild(img);
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                onPick(bank);
            });
            logos.appendChild(btn);
        });
        return logos;
    }

    function addOptionNotes(parent, option, ungraded) {
        if (option.grade === 'Issue') {
            addNote(parent, '<strong>Issue</strong> units have a known defect, priced lower. ' +
                '<a href="https://m.me/sulitzilla" target="_blank" rel="noopener noreferrer">Message us</a> for details before ordering.');
        }
        if (option.soft) {
            addNote(parent, '<strong>Soft unlocked</strong> units need to be unlocked before use — we do it for you before shipping. ' +
                '<button type="button" class="inst-note-link">Learn more</button>');
            parent.lastChild.querySelector('.inst-note-link').addEventListener('click', openSoftOverlay);
        }
        if (ungraded) {
            addNote(parent, 'Incoming used units are priced at Good. The final price may be higher if graded Excellent on arrival.');
        }
    }

    /** Units in stock or incoming; tapping a card under a unit expands its plans in place. */
    function createStockList(model, category, rerender) {
        const group = document.createElement('div');
        group.className = 'inst-choice-group';

        const label = document.createElement('p');
        label.className = 'inst-choice-label';
        label.textContent = 'Available stock';
        group.appendChild(label);

        const showSpec = model.stockUnits.some(function (u) { return u.spec; });
        const table = document.createElement('div');
        table.className = 'inventory-table inst-stock-table';
        if (!showSpec) table.classList.add('inst-stock-table--no-spec');
        if (category.key === 'laptops') table.classList.add('inst-stock-table--laptops');

        const header = document.createElement('div');
        header.className = 'inventory-table__header inventory-unit-row';
        [showSpec ? (SPEC_LABEL[category.key] || 'Option') : null, 'Color', 'Condition', 'Availability']
            .forEach(function (text) {
                if (text === null) return;
                const th = document.createElement('div');
                th.className = 'inventory-table__th';
                th.textContent = text;
                header.appendChild(th);
            });
        table.appendChild(header);

        const tbody = document.createElement('div');
        tbody.className = 'inventory-table__body';
        model.stockUnits.forEach(function (unit, index) {
            const unitOption = findOption(model, unit);
            const isOpen = unitOption && plansState.openUnit === index;

            const unitEl = document.createElement('div');
            unitEl.className = 'inst-unit' + (isOpen ? ' is-open' : '');

            const row = document.createElement('div');
            row.className = 'inventory-unit-row inst-stock-row';

            function toggle() {
                plansState.openUnit = isOpen ? null : index;
                rerender();
            }

            function pickBank(bank) {
                plansState.openUnit = isOpen && bank === selectedBank ? null : index;
                selectedBank = bank;
                rerender();
            }

            // A div rather than a <button> so the Soft badge's "?" button can sit inside it.
            if (unitOption) {
                row.setAttribute('role', 'button');
                row.tabIndex = 0;
                row.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                row.addEventListener('click', toggle);
                row.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                    }
                });
            }

            if (showSpec) row.appendChild(createSpecCell(unit.spec || '—', category.key));
            row.appendChild(createColorCell(unit.color));

            const condition = createConditionTags(unit, { ungraded: unit.ungraded });
            condition.className = 'inventory-unit-condition-col';
            if (unit.qty > 1) {
                const qty = document.createElement('span');
                qty.className = 'unit-qty-badge';
                qty.textContent = '×' + unit.qty;
                qty.setAttribute('aria-label', unit.qty + ' units');
                condition.appendChild(qty);
            }
            if (!unitOption) condition.appendChild(createInquireLink());
            row.appendChild(condition);

            row.appendChild(createStatusPill({ type: unit.status, eta: unit.eta }));
            unitEl.appendChild(row);

            if (unitOption) {
                const plans = document.createElement('div');
                plans.className = 'inst-unit-plans';
                plans.appendChild(createBankButtons(pickBank, isOpen ? selectedBank : null));
                if (isOpen) {
                    plans.appendChild(createPlansTable(unitOption.price, selectedBank));
                    addOptionNotes(plans, unitOption, unit.ungraded);
                }
                unitEl.appendChild(plans);
            }
            tbody.appendChild(unitEl);
        });
        table.appendChild(tbody);
        group.appendChild(table);
        return group;
    }

    /** Condition / storage / unlock / card pickers covering the options we'd order for a reservation. */
    function appendPickers(container, model, category, option, rerender) {
        const options = model.reserveOptions;

        function select(want) {
            rerender(resolveSelection(model, want));
        }

        function conditionOf(grade) {
            return grade === 'New' ? 'New' : 'Used';
        }

        // Always shown, even with a single choice, so a reservation spells out exactly what we'd order.
        const conditions = uniq(options.map(function (o) { return conditionOf(o.grade); }))
            .sort(function (a, b) { return a === 'New' ? -1 : b === 'New' ? 1 : 0; });
        const usedGrades = uniq(options
            .filter(function (o) { return o.grade !== 'New'; })
            .map(function (o) { return o.grade; }))
            .sort(function (a, b) { return gradeRank(a) - gradeRank(b); });
        container.appendChild(
            createChoiceGroup(
                'Condition',
                conditions.map(function (c) { return { value: c, label: c }; }),
                conditionOf(option.grade),
                function (condition) {
                    if (condition === conditionOf(option.grade)) return;
                    const used = options.filter(function (o) { return o.grade !== 'New'; });
                    const grade = condition === 'New' ? 'New' : cheapestRegular(used).grade;
                    select({ spec: option.spec, grade: grade, soft: option.soft });
                }
            )
        );

        if (option.grade !== 'New') {
            container.appendChild(
                createChoiceGroup(
                    'Grade',
                    usedGrades.map(function (grade) { return { value: grade, label: grade }; }),
                    option.grade,
                    function (grade) { select({ spec: option.spec, grade: grade, soft: option.soft }); }
                )
            );
        }

        const gradeOptions = options.filter(function (o) { return o.grade === option.grade; });
        const specs = uniq(gradeOptions.map(function (o) { return o.spec; }).filter(Boolean));
        if (specs.length) {
            container.appendChild(
                createChoiceGroup(
                    SPEC_LABEL[category.key] || 'Option',
                    specs.map(function (spec) { return { value: spec, label: spec }; }),
                    option.spec,
                    function (spec) { select({ spec: spec, grade: option.grade, soft: option.soft }); },
                    category.key === 'laptops' ? 'inst-choice--wide' : ''
                )
            );
        }

        const unlockOptions = gradeOptions.filter(function (o) { return o.spec === option.spec; });
        const hasFactory = unlockOptions.some(function (o) { return !o.soft; });
        const hasSoft = unlockOptions.some(function (o) { return o.soft; });
        if (hasFactory && hasSoft) {
            container.appendChild(
                createChoiceGroup(
                    'Unlock type',
                    [false, true].map(function (soft) {
                        return { value: soft, label: soft ? 'Soft unlocked' : 'Factory unlocked' };
                    }),
                    option.soft,
                    function (soft) { select({ spec: option.spec, grade: option.grade, soft: soft }); }
                )
            );
        }

        const bankGroup = document.createElement('div');
        bankGroup.className = 'inst-choice-group';
        const bankLabel = document.createElement('p');
        bankLabel.className = 'inst-choice-label';
        bankLabel.textContent = 'Your credit card';
        bankGroup.appendChild(bankLabel);
        bankGroup.appendChild(createBankLogos(function (bank) {
            selectedBank = bank;
            rerender(option);
        }, selectedBank));
        container.appendChild(bankGroup);

        container.appendChild(createPlansTable(option.price, selectedBank));
        addOptionNotes(container, option);
    }

    function renderPlansBody(model, category, option) {
        const scrollTop = modalBodyEl.scrollTop;
        modalBodyEl.innerHTML = '';
        const body = document.createElement('div');
        body.className = 'inst-plans-view';
        modalBodyEl.appendChild(body);

        function rerender(nextOption) {
            renderPlansBody(model, category, nextOption || option);
        }

        if (model.stockUnits.length) {
            body.appendChild(createStockList(model, category, rerender));
        }

        if (option) {
            if (model.stockUnits.length) {
                const other = document.createElement('details');
                other.className = 'inst-other';
                other.open = plansState.othersOpen;
                other.addEventListener('toggle', function () {
                    plansState.othersOpen = other.open;
                });
                const summary = document.createElement('summary');
                summary.className = 'inst-other__summary';
                summary.textContent = 'All options & prices';
                const hint = document.createElement('span');
                hint.className = 'inst-other__hint';
                hint.textContent = RESERVE_NOTE;
                summary.appendChild(hint);
                other.appendChild(summary);
                const otherBody = document.createElement('div');
                otherBody.className = 'inst-other__body';
                appendPickers(otherBody, model, category, option, rerender);
                other.appendChild(otherBody);
                body.appendChild(other);
            } else {
                const hint = document.createElement('p');
                hint.className = 'inst-reserve-note';
                hint.textContent = RESERVE_NOTE;
                body.appendChild(hint);
                appendPickers(body, model, category, option, rerender);
            }
        }

        modalBodyEl.scrollTop = scrollTop;
    }

    // ---- Modal ---------------------------------------------------------------

    function openPlansView(model, category, trigger) {
        lastTrigger = trigger;
        plansState.openUnit = null;
        plansState.othersOpen = false;
        modalTitleEl.textContent = model.model + ' — Installment Plans';
        modalBodyEl.scrollTop = 0;
        renderPlansBody(model, category, cheapestRegular(model.reserveOptions));
        overlayEl.hidden = false;
        overlayEl.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        modalBodyEl.scrollTop = 0;
        trigger.setAttribute('aria-expanded', 'true');
        modalCloseEl.focus();
    }

    function closeModal() {
        overlayEl.hidden = true;
        overlayEl.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastTrigger) {
            lastTrigger.setAttribute('aria-expanded', 'false');
            lastTrigger.focus();
            lastTrigger = null;
        }
    }

    function openSoftOverlay() {
        softLastFocus = document.activeElement;
        softOverlayEl.hidden = false;
        softOverlayEl.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        softOverlayEl.querySelector('.extracare-close').focus();
    }

    function closeSoftOverlay() {
        softOverlayEl.hidden = true;
        softOverlayEl.setAttribute('aria-hidden', 'true');
        if (overlayEl.hidden) document.body.style.overflow = '';
        if (softLastFocus && document.contains(softLastFocus)) softLastFocus.focus();
        softLastFocus = null;
    }

    overlayEl.addEventListener('click', function (e) {
        if (e.target === overlayEl) closeModal();
    });
    modalCloseEl.addEventListener('click', closeModal);
    softOverlayEl.addEventListener('click', function (e) {
        if (e.target === softOverlayEl) closeSoftOverlay();
    });
    softOverlayEl.querySelector('.extracare-close').addEventListener('click', closeSoftOverlay);
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!softOverlayEl.hidden) closeSoftOverlay();
        else if (!overlayEl.hidden) closeModal();
    });

    // ---- Load ----------------------------------------------------------------

    const inventoryPromise = fetch(INVENTORY_URL, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (json) {
            const list = Array.isArray(json) ? json : json && json.data;
            return Array.isArray(list) && list.length ? list : null;
        })
        .catch(function () { return null; });

    const cashPricesPromise = fetch(PRICES_URL, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (json) {
            const list = Array.isArray(json) ? json : json && json.data;
            return Array.isArray(list) && list.length ? list : null;
        })
        .catch(function () { return null; });

    fetch(DATA_URL, { cache: 'no-cache' })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function (data) {
            return Promise.all([inventoryPromise, cashPricesPromise]).then(function (extra) {
                return { data: data, inventory: extra[0], cashPrices: extra[1] };
            });
        })
        .then(function (result) {
            const data = result.data;
            banks = data.banks || [];
            selectedBank = banks[0];
            fromFee = lowestFee();

            const liveByModel = result.inventory ? buildLiveUnitsByModel(result.inventory) : null;
            if (result.cashPrices) {
                const phones = (data.categories || []).find(function (c) { return c.key === 'phones'; });
                if (phones) {
                    phones.models = phones.models || [];
                    applyCashPricing(phones, buildCashPricesByModel(result.cashPrices), liveByModel);
                }
            }
            const categories = (data.categories || []).filter(function (c) {
                return c.models && c.models.length;
            });
            categories.forEach(function (category) {
                category.models.forEach(function (model) {
                    const useLive = liveByModel && category.key === 'phones' && /^Pixel /.test(model.model);
                    prepareModel(model, category.key, useLive ? liveByModel.get(model.model) || [] : null);
                });
            });

            loadingEl.hidden = true;
            renderTabs(categories);
            renderCategory(categories[0]);
        })
        .catch(function () {
            loadingEl.hidden = true;
            emptyEl.textContent = 'Could not load installment prices. Please refresh the page.';
            emptyEl.hidden = false;
        });
})();
