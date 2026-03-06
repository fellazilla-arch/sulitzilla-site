// Mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function() {
            const isActive = navLinks.classList.contains('active');
            
            if (isActive) {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                if (overlay) {
                    overlay.classList.remove('active');
                }
                document.body.style.overflow = '';
            } else {
                navLinks.classList.add('active');
                menuToggle.classList.add('active');
                menuToggle.setAttribute('aria-expanded', 'true');
                if (overlay) {
                    overlay.classList.add('active');
                }
                document.body.style.overflow = 'hidden';
            }
        });
        
        if (overlay) {
            overlay.addEventListener('click', function() {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
        
        const navLinkItems = navLinks.querySelectorAll('a');
        navLinkItems.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    navLinks.classList.remove('active');
                    menuToggle.classList.remove('active');
                    menuToggle.setAttribute('aria-expanded', 'false');
                    if (overlay) {
                        overlay.classList.remove('active');
                    }
                    document.body.style.overflow = '';
                }
            });
        });
        
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                if (overlay) {
                    overlay.classList.remove('active');
                }
                document.body.style.overflow = '';
            }
        });
    }

    // Fallback pricing data (used when Grist is not configured or fetch fails).
    // To use Grist: set window.GRIST_PRICES_URL before this script (e.g. to your Netlify function URL).
    const FALLBACK_PRICING_DATA = [
        // Pixel 2 series – 64 / 128 GB
        { model: 'Pixel 2', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 2', storage: '64GB', condition: 'Used', price: null },
        { model: 'Pixel 2', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 2', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 2 XL', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 2 XL', storage: '64GB', condition: 'Used', code: 'B1113'},
        { model: 'Pixel 2 XL', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 2 XL', storage: '128GB', condition: 'Used', code: 'B0931'},

        // Pixel 3 series – 64 / 128 GB
        { model: 'Pixel 3', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 3', storage: '64GB', condition: 'Used', price: null },
        { model: 'Pixel 3', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 3', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 3 XL', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 3 XL', storage: '64GB', condition: 'Used', price: null },
        { model: 'Pixel 3 XL', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 3 XL', storage: '128GB', condition: 'Used', price: null },

        // Pixel 3a series – 64 GB
        { model: 'Pixel 3a', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 3a', storage: '64GB', condition: 'Used', price: null },
        { model: 'Pixel 3a XL', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 3a XL', storage: '64GB', condition: 'Used', price: null },

        // Pixel 4 series – 64 / 128 GB
        { model: 'Pixel 4', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 4', storage: '64GB', condition: 'Used', price: null },
        { model: 'Pixel 4', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 4', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 4 XL', storage: '64GB', condition: 'New', price: null },
        { model: 'Pixel 4 XL', storage: '64GB', condition: 'Used', price: null },
        { model: 'Pixel 4 XL', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 4 XL', storage: '128GB', condition: 'Used', price: null },

        // Pixel 4a / 4a 5G – 128 GB
        { model: 'Pixel 4a', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 4a', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 4a 5G', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 4a 5G', storage: '128GB', condition: 'Used', price: null },

        // Pixel 5 / 5a – 128 GB
        { model: 'Pixel 5', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 5', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 5a', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 5a', storage: '128GB', condition: 'Used', price: null },

        // Pixel 6 series
        { model: 'Pixel 6', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 6', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 6', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 6', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 6 Pro', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 6 Pro', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 6 Pro', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 6 Pro', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 6 Pro', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 6 Pro', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 6a', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 6a', storage: '128GB', condition: 'Used', price: null },

        // Pixel 7 series
        { model: 'Pixel 7', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 7', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 7', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 7', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 7 Pro', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 7 Pro', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 7 Pro', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 7 Pro', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 7 Pro', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 7 Pro', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 7a', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 7a', storage: '128GB', condition: 'Used', price: null },

        // Pixel Fold – 256 / 512 GB
        { model: 'Pixel Fold', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel Fold', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel Fold', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel Fold', storage: '512GB', condition: 'Used', price: null },

        // Pixel 8 series
        { model: 'Pixel 8', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 8', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 8', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 8', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 8 Pro', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 8 Pro', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 8 Pro', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 8 Pro', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 8 Pro', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 8 Pro', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 8a', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 8a', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 8a', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 8a', storage: '256GB', condition: 'Used', price: null },

        // Pixel 9 series – based on current leaks/specs, excluding 1TB
        { model: 'Pixel 9', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 9', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 9', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 9', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 9 Pro', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 9 Pro', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 9 Pro', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 9 Pro', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 9 Pro', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 9 Pro', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 9 Pro XL', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 9 Pro XL', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 9 Pro XL', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 9 Pro XL', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 9 Pro Fold', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 9 Pro Fold', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 9 Pro Fold', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 9 Pro Fold', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 9a', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 9a', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 9a', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 9a', storage: '256GB', condition: 'Used', price: null },

        // Pixel 10 series – from comparison table, excluding 1TB
        { model: 'Pixel 10', storage: '128GB', condition: 'New', code: 'B1031' },
        { model: 'Pixel 10', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 10', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 10', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 10 Pro', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 10 Pro', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 10 Pro', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 10 Pro', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 10 Pro', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 10 Pro', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 10 Pro XL', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 10 Pro XL', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 10 Pro XL', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 10 Pro XL', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 10 Pro Fold', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 10 Pro Fold', storage: '256GB', condition: 'Used', price: null },
        { model: 'Pixel 10 Pro Fold', storage: '512GB', condition: 'New', price: null },
        { model: 'Pixel 10 Pro Fold', storage: '512GB', condition: 'Used', price: null },
        { model: 'Pixel 10a', storage: '128GB', condition: 'New', price: null },
        { model: 'Pixel 10a', storage: '128GB', condition: 'Used', price: null },
        { model: 'Pixel 10a', storage: '256GB', condition: 'New', price: null },
        { model: 'Pixel 10a', storage: '256GB', condition: 'Used', price: null }
    ];

    const pricingListEl = document.getElementById('pricing-list');
    const pricingEmptyStateEl = document.getElementById('pricing-empty-state');

    function renderPricingList(pricingData) {
        if (!pricingListEl || !pricingEmptyStateEl) return;
        const models = Array.from(new Set(pricingData.map(item => item.model)));
        models.reverse();

        if (!models.length) {
            pricingEmptyStateEl.hidden = false;
            return;
        }

        pricingEmptyStateEl.hidden = true;
        pricingListEl.innerHTML = '';

        models.forEach(modelName => {
            const variants = pricingData.filter(item => item.model === modelName);

            const groupEl = document.createElement('section');
            groupEl.className = 'model-group';

            const headerButton = document.createElement('button');
            headerButton.type = 'button';
            headerButton.className = 'model-header';
            headerButton.setAttribute('aria-expanded', 'false');

            const headerLeft = document.createElement('div');
            headerLeft.className = 'model-header-left';

            const titleEl = document.createElement('span');
            titleEl.className = 'model-title';
            titleEl.textContent = modelName;

            headerLeft.appendChild(titleEl);

            headerButton.appendChild(headerLeft);

            const bodyEl = document.createElement('div');
            bodyEl.className = 'model-body';
            bodyEl.hidden = true;

            variants.forEach(variant => {
                const rowEl = document.createElement('div');
                rowEl.className = 'variant-row';

                const mainEl = document.createElement('div');
                mainEl.className = 'variant-main';

                const metaEl = document.createElement('div');
                metaEl.className = 'variant-meta';
                metaEl.textContent = `${variant.storage} • ${variant.condition}`;

                const tagsEl = document.createElement('div');
                tagsEl.className = 'variant-tags';

                const conditionTag = document.createElement('span');
                conditionTag.className =
                    'tag ' + (variant.condition === 'New' ? 'tag--condition-new' : 'tag--condition-used');
                conditionTag.textContent = variant.condition;

                tagsEl.appendChild(conditionTag);

                mainEl.appendChild(metaEl);
                mainEl.appendChild(tagsEl);

                const priceEl = document.createElement('div');
                priceEl.className = 'variant-price';

                if (variant.price !== null && variant.price !== undefined && variant.price !== '') {
                    if (typeof variant.price === 'number') {
                        priceEl.textContent = `₱${variant.price.toLocaleString('en-PH')}`;
                    } else {
                        priceEl.textContent = `₱${variant.price}`;
                    }
                } else {
                    priceEl.textContent = (variant.code && String(variant.code).trim()) ? 'Set price' : 'Not Available';
                    priceEl.classList.add('placeholder');
                }

                rowEl.appendChild(mainEl);
                rowEl.appendChild(priceEl);

                bodyEl.appendChild(rowEl);
            });

            headerButton.addEventListener('click', () => {
                const isExpanded = headerButton.getAttribute('aria-expanded') === 'true';
                const nextExpanded = !isExpanded;
                headerButton.setAttribute('aria-expanded', String(nextExpanded));
                bodyEl.hidden = !nextExpanded;
                groupEl.classList.toggle('is-open', nextExpanded);
            });

            groupEl.appendChild(headerButton);
            groupEl.appendChild(bodyEl);
            pricingListEl.appendChild(groupEl);
        });
    }

    const CACHE_KEY = 'sulitzilla_prices';
    const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
    var hourlyRefreshTimer = null;

    function mergePricesFromList(list) {
        if (!Array.isArray(list) || list.length === 0) return FALLBACK_PRICING_DATA;
        const priceByCode = {};
        list.forEach(function (row) {
            const rawCode = row.code ?? row.CODE ?? row.Code;
            const p = row.price ?? row.PRICES ?? row.Prices;
            if (rawCode == null || rawCode === '') return;
            if (p === null || p === undefined || p === '') return;
            const num = typeof p === 'number' ? p : Number(p);
            if (Number.isNaN(num) || num <= 0) return;
            const c = String(rawCode).trim().toUpperCase();
            priceByCode[c] = num;
            if (/^\d+$/.test(c)) priceByCode['B' + c] = num;
        });
        return FALLBACK_PRICING_DATA.map(function (row) {
            const codeStr = row.code ? String(row.code).trim().toUpperCase() : '';
            const fromGrist = codeStr && (priceByCode[codeStr] ?? priceByCode[codeStr.replace(/^B/, '')]);
            return {
                model: row.model,
                storage: row.storage,
                condition: row.condition,
                code: row.code,
                price: (fromGrist !== undefined && fromGrist !== null) ? fromGrist : row.price
            };
        });
    }

    async function loadPrices(forceRefresh) {
        let data = FALLBACK_PRICING_DATA;
        const url = window.GRIST_PRICES_URL;
        if (url) {
            var useCache = forceRefresh !== true;
            if (useCache) {
                try {
                    const cached = localStorage.getItem(CACHE_KEY);
                    const cachedAt = localStorage.getItem(CACHE_KEY + '_at');
                    const age = cachedAt ? Date.now() - parseInt(cachedAt, 10) : CACHE_MAX_AGE_MS + 1;
                    if (cached && age < CACHE_MAX_AGE_MS) {
                        const list = JSON.parse(cached);
                        if (Array.isArray(list)) {
                            data = mergePricesFromList(list);
                            renderPricingList(data);
                            scheduleHourlyRefresh();
                            return;
                        }
                    }
                } catch (e) {}
            }
            try {
                const r = await fetch(url);
                if (r.ok) {
                    const json = await r.json();
                    const list = Array.isArray(json) ? json : (json && json.data);
                    if (Array.isArray(list) && list.length > 0) {
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify(list));
                            localStorage.setItem(CACHE_KEY + '_at', String(Date.now()));
                        } catch (e) {}
                        data = mergePricesFromList(list);
                    }
                }
            } catch (e) {}
        }
        renderPricingList(data);
        scheduleHourlyRefresh();
    }

    function scheduleHourlyRefresh() {
        if (hourlyRefreshTimer) clearTimeout(hourlyRefreshTimer);
        hourlyRefreshTimer = setTimeout(function () {
            loadPrices(true);
        }, CACHE_MAX_AGE_MS);
    }

    loadPrices(false);

    const refreshBtn = document.getElementById('refresh-prices-btn');
    if (refreshBtn) {
        var showRefresh = /[?&]refresh=1/i.test(window.location.search);
        if (showRefresh) {
            refreshBtn.classList.remove('hidden');
            refreshBtn.setAttribute('aria-hidden', 'false');
        }
        refreshBtn.addEventListener('click', function () {
            try {
                localStorage.removeItem(CACHE_KEY);
                localStorage.removeItem(CACHE_KEY + '_at');
            } catch (e) {}
            if (hourlyRefreshTimer) clearTimeout(hourlyRefreshTimer);
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Updating…';
            loadPrices(true).then(function () {
                refreshBtn.disabled = false;
                refreshBtn.textContent = 'Refresh prices';
            });
        });
    }
});

