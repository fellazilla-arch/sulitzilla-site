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

    // Good vs Excellent popup
    const goodVsExcellentTrigger = document.getElementById('good-vs-excellent-trigger');
    const goodVsExcellentOverlay = document.getElementById('good-vs-excellent-overlay');
    const goodVsExcellentClose = goodVsExcellentOverlay && goodVsExcellentOverlay.querySelector('.good-vs-excellent-close');
    if (goodVsExcellentTrigger && goodVsExcellentOverlay) {
        function openGoodVsExcellent() {
            goodVsExcellentOverlay.hidden = false;
            goodVsExcellentOverlay.setAttribute('aria-hidden', 'false');
            goodVsExcellentTrigger.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        }
        function closeGoodVsExcellent() {
            goodVsExcellentOverlay.hidden = true;
            goodVsExcellentOverlay.setAttribute('aria-hidden', 'true');
            goodVsExcellentTrigger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
        goodVsExcellentTrigger.addEventListener('click', openGoodVsExcellent);
        goodVsExcellentOverlay.addEventListener('click', function(e) {
            if (e.target === goodVsExcellentOverlay) closeGoodVsExcellent();
        });
        if (goodVsExcellentClose) goodVsExcellentClose.addEventListener('click', closeGoodVsExcellent);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !goodVsExcellentOverlay.hidden) closeGoodVsExcellent();
        });
    }

    // ExtraCare popup
    const extracareTrigger = document.getElementById('extracare-trigger');
    const extracareOverlay = document.getElementById('extracare-overlay');
    const extracareClose = extracareOverlay && extracareOverlay.querySelector('.extracare-close');
    if (extracareTrigger && extracareOverlay) {
        function openExtracare() {
            extracareOverlay.hidden = false;
            extracareOverlay.setAttribute('aria-hidden', 'false');
            extracareTrigger.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        }
        function closeExtracare() {
            extracareOverlay.hidden = true;
            extracareOverlay.setAttribute('aria-hidden', 'true');
            extracareTrigger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
        extracareTrigger.addEventListener('click', openExtracare);
        extracareOverlay.addEventListener('click', function(e) {
            if (e.target === extracareOverlay) closeExtracare();
        });
        if (extracareClose) extracareClose.addEventListener('click', closeExtracare);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !extracareOverlay.hidden) closeExtracare();
        });
    }

    // Inclusions popup
    const inclusionsTrigger = document.getElementById('inclusions-trigger');
    const inclusionsOverlay = document.getElementById('inclusions-overlay');
    const inclusionsClose = inclusionsOverlay && inclusionsOverlay.querySelector('.extracare-close');
    if (inclusionsTrigger && inclusionsOverlay) {
        function openInclusions() {
            inclusionsOverlay.hidden = false;
            inclusionsOverlay.setAttribute('aria-hidden', 'false');
            inclusionsTrigger.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        }
        function closeInclusions() {
            inclusionsOverlay.hidden = true;
            inclusionsOverlay.setAttribute('aria-hidden', 'true');
            inclusionsTrigger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
        inclusionsTrigger.addEventListener('click', openInclusions);
        inclusionsOverlay.addEventListener('click', function(e) {
            if (e.target === inclusionsOverlay) closeInclusions();
        });
        if (inclusionsClose) inclusionsClose.addEventListener('click', closeInclusions);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !inclusionsOverlay.hidden) closeInclusions();
        });
    }

    // Fallback pricing data (used when Grist is not configured or fetch fails).
    // To use Grist: set window.GRIST_PRICES_URL before this script (e.g. to your Netlify function URL).
    // For Used variants: the price from Grist (by CODE) is the Good price; Excellent = Good + this amount.
    const USED_EXCELLENT_ADDITION_PHP = 1000;
    const FALLBACK_PRICING_DATA = [
        // Pixel 2 series – 64 / 128 GB
        { model: 'Pixel 2', storage: '64GB', condition: 'New', code: 'A1448' },
        { model: 'Pixel 2', storage: '64GB', condition: 'Used', code: 'B0999' },
        { model: 'Pixel 2', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 2', storage: '128GB', condition: 'Used', code: 'A7182' },
        { model: 'Pixel 2 XL', storage: '64GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 2 XL', storage: '64GB', condition: 'Used', code: 'B1113'},
        { model: 'Pixel 2 XL', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 2 XL', storage: '128GB', condition: 'Used', code: 'B0931'},

        // Pixel 3 series – 64 / 128 GB
        { model: 'Pixel 3', storage: '64GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 3', storage: '64GB', condition: 'Used', code: 'B0042' },
        { model: 'Pixel 3', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 3', storage: '128GB', condition: 'Used', code: 'A1479' },
        { model: 'Pixel 3 XL', storage: '64GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 3 XL', storage: '64GB', condition: 'Used', code: 'B0043' },
        { model: 'Pixel 3 XL', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 3 XL', storage: '128GB', condition: 'Used', code: 'A1900' },

        // Pixel 3a series – 64 GB
        { model: 'Pixel 3a', storage: '64GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 3a', storage: '64GB', condition: 'Used', code: 'A7913' },
        { model: 'Pixel 3a XL', storage: '64GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 3a XL', storage: '64GB', condition: 'Used', code: 'A8474' },

        // Pixel 4 series – 64 / 128 GB
        { model: 'Pixel 4', storage: '64GB', condition: 'New', code: '' },
        { model: 'Pixel 4', storage: '64GB', condition: 'Used', code: 'A8039' },
        { model: 'Pixel 4', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 4', storage: '128GB', condition: 'Used', code: 'B0044' },
        { model: 'Pixel 4 XL', storage: '64GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 4 XL', storage: '64GB', condition: 'Used', code: 'A1424' },
        { model: 'Pixel 4 XL', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 4 XL', storage: '128GB', condition: 'Used', code: 'A8535' },

        // Pixel 4a / 4a 5G – 128 GB
        { model: 'Pixel 4a', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 4a', storage: '128GB', condition: 'Used', code: 'A8825' },
        { model: 'Pixel 4a 5G', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 4a 5G', storage: '128GB', condition: 'Used', code: 'A6042' },

        // Pixel 5 / 5a – 128 GB
        { model: 'Pixel 5', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 5', storage: '128GB', condition: 'Used', code: 'B2146' },
        { model: 'Pixel 5a', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 5a', storage: '128GB', condition: 'Used', code: 'B1434' },

        // Pixel 6 series
        { model: 'Pixel 6', storage: '128GB', condition: 'New', code: 'B1574' },
        { model: 'Pixel 6', storage: '128GB', condition: 'Used', code: 'B1033' },
        { model: 'Pixel 6', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 6', storage: '256GB', condition: 'Used', code: 'B1181' },
        { model: 'Pixel 6 Pro', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 6 Pro', storage: '128GB', condition: 'Used', code: 'B1055' },
        { model: 'Pixel 6 Pro', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 6 Pro', storage: '256GB', condition: 'Used', code: 'A7964' },
        { model: 'Pixel 6 Pro', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 6 Pro', storage: '512GB', condition: 'Used', code: 'A7181' },
        { model: 'Pixel 6a', storage: '128GB', condition: 'New', code: 'A5731' },
        { model: 'Pixel 6a', storage: '128GB', condition: 'Used', code: 'A8713' },

        // Pixel 7 series
        { model: 'Pixel 7', storage: '128GB', condition: 'New', code: 'A9406' },
        { model: 'Pixel 7', storage: '128GB', condition: 'Used', code: 'A6444' },
        { model: 'Pixel 7', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 7', storage: '256GB', condition: 'Used', code: 'A6446' },
        { model: 'Pixel 7 Pro', storage: '128GB', condition: 'New', code: 'B1586' },
        { model: 'Pixel 7 Pro', storage: '128GB', condition: 'Used', code: 'A6608' },
        { model: 'Pixel 7 Pro', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 7 Pro', storage: '256GB', condition: 'Used', code: 'A7179' },
        { model: 'Pixel 7 Pro', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 7 Pro', storage: '512GB', condition: 'Used', code: 'A6311' },
        { model: 'Pixel 7a', storage: '128GB', condition: 'New', code: 'A7297' },
        { model: 'Pixel 7a', storage: '128GB', condition: 'Used', code: 'A5059' },

        // Pixel Fold – 256 / 512 GB
        { model: 'Pixel Fold', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel Fold', storage: '256GB', condition: 'Used', code: 'B1713' },
        { model: 'Pixel Fold', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel Fold', storage: '512GB', condition: 'Used', code: 'A8909' },

        // Pixel 8 series
        { model: 'Pixel 8', storage: '128GB', condition: 'New', code: 'B2169' },
        { model: 'Pixel 8', storage: '128GB', condition: 'Used', code: 'B1112' },
        { model: 'Pixel 8', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 8', storage: '256GB', condition: 'Used', code: 'A7474' },
        { model: 'Pixel 8 Pro', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 8 Pro', storage: '128GB', condition: 'Used', code: 'B0979' },
        { model: 'Pixel 8 Pro', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 8 Pro', storage: '256GB', condition: 'Used', code: 'A9124' },
        { model: 'Pixel 8 Pro', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 8 Pro', storage: '512GB', condition: 'Used', code: 'A3486' },
        { model: 'Pixel 8a', storage: '128GB', condition: 'New', code: 'A9689' },
        { model: 'Pixel 8a', storage: '128GB', condition: 'Used', code: 'B0981' },
        { model: 'Pixel 8a', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 8a', storage: '256GB', condition: 'Used', code: 'A9931' },

        // Pixel 9 series – based on current leaks/specs, excluding 1TB
        { model: 'Pixel 9', storage: '128GB', condition: 'New', code: 'B0840' },
        { model: 'Pixel 9', storage: '128GB', condition: 'Used', code: 'B0623' },
        { model: 'Pixel 9', storage: '256GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 9', storage: '256GB', condition: 'Used', code: 'B0439' },
        { model: 'Pixel 9 Pro', storage: '128GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 9 Pro', storage: '128GB', condition: 'Used', code: 'B1711' },
        { model: 'Pixel 9 Pro', storage: '256GB', condition: 'New', code: 'B0072' },
        { model: 'Pixel 9 Pro', storage: '256GB', condition: 'Used', code: 'B1907' },
        { model: 'Pixel 9 Pro', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 9 Pro', storage: '512GB', condition: 'Used', code: 'B1492' },
        { model: 'Pixel 9 Pro XL', storage: '128GB', condition: 'New', code: 'A7608' },
        { model: 'Pixel 9 Pro XL', storage: '128GB', condition: 'Used', code: 'A7607' },
        { model: 'Pixel 9 Pro XL', storage: '256GB', condition: 'New', code: 'A9499' },
        { model: 'Pixel 9 Pro XL', storage: '256GB', condition: 'Used', code: 'A7606' },
        { model: 'Pixel 9 Pro XL', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 9 Pro XL', storage: '512GB', condition: 'Used', code: 'A9727' },
        { model: 'Pixel 9 Pro Fold', storage: '256GB', condition: 'New', code: 'A9587' },
        { model: 'Pixel 9 Pro Fold', storage: '256GB', condition: 'Used', code: 'A7714' },
        { model: 'Pixel 9 Pro Fold', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 9 Pro Fold', storage: '512GB', condition: 'Used', code: 'CODE: ' },
        { model: 'Pixel 9a', storage: '128GB', condition: 'New', code: 'B1714' },
        { model: 'Pixel 9a', storage: '128GB', condition: 'Used', code: 'B0230' },
        { model: 'Pixel 9a', storage: '256GB', condition: 'New', code: 'B1782' },
        { model: 'Pixel 9a', storage: '256GB', condition: 'Used', code: 'B0951' },

        // Pixel 10 series – from comparison table, excluding 1TB
        { model: 'Pixel 10', storage: '128GB', condition: 'New', code: 'B1031' },
        { model: 'Pixel 10', storage: '128GB', condition: 'Used', code: 'B1338' },
        { model: 'Pixel 10', storage: '256GB', condition: 'New', code: 'B1035' },
        { model: 'Pixel 10', storage: '256GB', condition: 'Used', code: 'CODE: ' },
        { model: 'Pixel 10 Pro', storage: '128GB', condition: 'New', code: 'B0975' },
        { model: 'Pixel 10 Pro', storage: '128GB', condition: 'Used', code: 'B0613' },
        { model: 'Pixel 10 Pro', storage: '256GB', condition: 'New', code: 'B1159' },
        { model: 'Pixel 10 Pro', storage: '256GB', condition: 'Used', code: 'B2101' },
        { model: 'Pixel 10 Pro', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 10 Pro', storage: '512GB', condition: 'Used', code: 'A5658' },
        { model: 'Pixel 10 Pro XL', storage: '256GB', condition: 'New', code: 'B1059' },
        { model: 'Pixel 10 Pro XL', storage: '256GB', condition: 'Used', code: 'B0873' },
        { model: 'Pixel 10 Pro XL', storage: '512GB', condition: 'New', code: 'B1111' },
        { model: 'Pixel 10 Pro XL', storage: '512GB', condition: 'Used', code: 'A8690' },
        { model: 'Pixel 10 Pro Fold', storage: '256GB', condition: 'New', code: 'B0948' },
        { model: 'Pixel 10 Pro Fold', storage: '256GB', condition: 'Used', code: 'A8733' },
        { model: 'Pixel 10 Pro Fold', storage: '512GB', condition: 'New', code: 'CODE: ' },
        { model: 'Pixel 10 Pro Fold', storage: '512GB', condition: 'Used', code: 'CODE: ' },
        { model: 'Pixel 10a', storage: '128GB', condition: 'New', code: 'B2030' },
        { model: 'Pixel 10a', storage: '128GB', condition: 'Used', code: 'CODE: ' },
        { model: 'Pixel 10a', storage: '256GB', condition: 'New', code: 'B2171' },
        { model: 'Pixel 10a', storage: '256GB', condition: 'Used', code: 'CODE: ' }
    ];

    const pricingListEl = document.getElementById('pricing-list');
    const pricingEmptyStateEl = document.getElementById('pricing-empty-state');
    const pricingLoadingEl = document.getElementById('pricing-loading');

    function showPricingLoader() {
        if (pricingLoadingEl) pricingLoadingEl.hidden = false;
    }
    function hidePricingLoader() {
        if (pricingLoadingEl) pricingLoadingEl.hidden = true;
    }

    function createInquireLink() {
        const link = document.createElement('a');
        link.href = 'https://m.me/sulitzilla';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Inquire';
        link.className = 'price-inquire-link';
        return link;
    }

    // Explicit generations ordered by release date (newest to oldest).
    // Pixel 10a is the newest device overall.
    const GENERATIONS_NEWEST_TO_OLDEST = [
        { label: 'Pixel 10a', models: ['Pixel 10a'] },
        {
            label: 'Pixel 10 generation',
            models: ['Pixel 10', 'Pixel 10 Pro', 'Pixel 10 Pro XL', 'Pixel 10 Pro Fold']
        },
        { label: 'Pixel 9a', models: ['Pixel 9a'] },
        {
            label: 'Pixel 9 generation',
            models: ['Pixel 9', 'Pixel 9 Pro', 'Pixel 9 Pro XL', 'Pixel 9 Pro Fold']
        },
        { label: 'Pixel 8a', models: ['Pixel 8a'] },
        {
            label: 'Pixel 8 generation',
            models: ['Pixel 8', 'Pixel 8 Pro']
        },
        { label: 'Pixel Fold (first foldable)', models: ['Pixel Fold'] },
        { label: 'Pixel 7a', models: ['Pixel 7a'] },
        {
            label: 'Pixel 7 generation',
            models: ['Pixel 7', 'Pixel 7 Pro']
        },
        { label: 'Pixel 6a', models: ['Pixel 6a'] },
        {
            label: 'Pixel 6 generation (first Tensor chip)',
            models: ['Pixel 6', 'Pixel 6 Pro']
        },
        { label: 'Pixel 5a generation', models: ['Pixel 5a'] },
        { label: 'Pixel 5 generation', models: ['Pixel 5'] },
        {
            label: 'Pixel 4a generation',
            models: ['Pixel 4a', 'Pixel 4a 5G']
        },
        {
            label: 'Pixel 4 generation',
            models: ['Pixel 4', 'Pixel 4 XL']
        },
        {
            label: 'Pixel 3a generation (mid-cycle budget line begins)',
            models: ['Pixel 3a', 'Pixel 3a XL']
        },
        {
            label: 'Pixel 3 generation',
            models: ['Pixel 3', 'Pixel 3 XL']
        },
        {
            label: 'Pixel 2 generation',
            models: ['Pixel 2', 'Pixel 2 XL']
        }
    ];

    function createModelGroupElement(modelName, variants) {
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
            metaEl.textContent = variant.storage;

            const tagsEl = document.createElement('div');
            tagsEl.className = 'variant-tags';

            const conditionTag = document.createElement('span');
            conditionTag.className =
                'tag ' + (variant.condition === 'New' ? 'tag--condition-new' : 'tag--condition-used');
            conditionTag.textContent = variant.condition;

            tagsEl.appendChild(conditionTag);

            mainEl.appendChild(metaEl);
            mainEl.appendChild(tagsEl);

            const hasPrice = variant.price !== null && variant.price !== undefined && variant.price !== '';
            const priceNum = hasPrice && typeof variant.price === 'number' ? variant.price : (hasPrice ? Number(variant.price) : null);
            const placeholderText = (variant.code && String(variant.code).trim()) ? 'Set price' : 'Not Available';

            // If this variant has no price, skip rendering it entirely.
            // This preserves the data in script.js while hiding "Inquire" rows from the sheet.
            if (!hasPrice || priceNum === null || Number.isNaN(priceNum)) {
                return;
            }

            const priceEl = document.createElement('div');
            priceEl.className = 'variant-price';

            if (hasPrice) {
                if (typeof variant.price === 'number') {
                    priceEl.textContent = `₱${variant.price.toLocaleString('en-PH')}`;
                } else {
                    priceEl.textContent = `₱${variant.price}`;
                }
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

        return groupEl;
    }

    // Flattened model order for table view, newest (Pixel 10a) to oldest (Pixel 2).
    const MODEL_ORDER_NEWEST_TO_OLDEST = [
        'Pixel 10a',
        'Pixel 10 Pro Fold',
        'Pixel 10 Pro XL',
        'Pixel 10 Pro',
        'Pixel 10',
        'Pixel 9a',
        'Pixel 9 Pro Fold',
        'Pixel 9 Pro XL',
        'Pixel 9 Pro',
        'Pixel 9',
        'Pixel 8a',
        'Pixel 8 Pro',
        'Pixel 8',
        'Pixel Fold',
        'Pixel 7a',
        'Pixel 7 Pro',
        'Pixel 7',
        'Pixel 6a',
        'Pixel 6 Pro',
        'Pixel 6',
        'Pixel 5a',
        'Pixel 5',
        'Pixel 4a 5G',
        'Pixel 4a',
        'Pixel 4 XL',
        'Pixel 4',
        'Pixel 3a XL',
        'Pixel 3a',
        'Pixel 3 XL',
        'Pixel 3',
        'Pixel 2 XL',
        'Pixel 2'
    ];

    function renderPricingList(pricingData) {
        if (!pricingListEl || !pricingEmptyStateEl) return;

        // Build variants per model, skipping rows without a valid price.
        const variantsByModel = new Map();

        pricingData.forEach(item => {
            const hasPrice = item.price !== null && item.price !== undefined && item.price !== '';
            const priceNum = hasPrice && typeof item.price === 'number'
                ? item.price
                : (hasPrice ? Number(item.price) : null);
            if (!hasPrice || priceNum === null || Number.isNaN(priceNum)) {
                return;
            }

            const model = item.model;
            if (!variantsByModel.has(model)) {
                variantsByModel.set(model, []);
            }
            variantsByModel.get(model).push({
                model: item.model,
                storage: item.storage,
                condition: item.condition,
                code: item.code,
                price: priceNum
            });
        });

        let models = Array.from(variantsByModel.entries())
            .map(([model, variants]) => {
                // Sort so New variants appear before Used within each model,
                // and then by storage size (where possible) for a stable order.
                variants.sort((a, b) => {
                    const condA = a.condition === 'New' ? 0 : 1;
                    const condB = b.condition === 'New' ? 0 : 1;
                    if (condA !== condB) return condA - condB;

                    const numA = parseInt(String(a.storage).replace(/\D/g, ''), 10);
                    const numB = parseInt(String(b.storage).replace(/\D/g, ''), 10);
                    if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
                        return numA - numB;
                    }
                    return String(a.storage).localeCompare(String(b.storage));
                });
                return { model, variants };
            })
            .filter(entry => entry.variants.length > 0);

        if (!models.length) {
            pricingEmptyStateEl.hidden = false;
            pricingListEl.innerHTML = '';
            return;
        }

        // Sort models by release (newest → oldest) using MODEL_ORDER_NEWEST_TO_OLDEST.
        models.sort((a, b) => {
            const idxA = MODEL_ORDER_NEWEST_TO_OLDEST.indexOf(a.model);
            const idxB = MODEL_ORDER_NEWEST_TO_OLDEST.indexOf(b.model);
            const rankA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
            const rankB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
            return rankA - rankB;
        });

        pricingEmptyStateEl.hidden = true;
        pricingListEl.innerHTML = '';

        const fragment = document.createDocumentFragment();
        models.forEach(entry => {
            const groupEl = createModelGroupElement(entry.model, entry.variants);
            if (groupEl) fragment.appendChild(groupEl);
        });

        pricingListEl.appendChild(fragment);
    }

    const CACHE_KEY = 'sulitzilla_prices';
    const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
    var hourlyRefreshTimer = null;

    function setPricingLastUpdated(timestamp) {
        const el = document.getElementById('pricing-last-updated');
        if (!el) return;
        if (timestamp == null || timestamp === '') {
            el.textContent = '';
            return;
        }
        const d = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10));
        if (Number.isNaN(d.getTime())) {
            el.textContent = '';
            return;
        }
        el.textContent = 'Last updated: ' + d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

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
        showPricingLoader();
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
                            hidePricingLoader();
                            setPricingLastUpdated(cachedAt);
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
                            const now = Date.now();
                            localStorage.setItem(CACHE_KEY, JSON.stringify(list));
                            localStorage.setItem(CACHE_KEY + '_at', String(now));
                            setPricingLastUpdated(now);
                        } catch (e) {}
                        data = mergePricesFromList(list);
                    }
                }
            } catch (e) {}
        }
        hidePricingLoader();
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

