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
    const goodVsExcellentClose =
        goodVsExcellentOverlay && goodVsExcellentOverlay.querySelector('.good-vs-excellent-close');

    function setGoodVsExcellentExpanded(isExpanded) {
        if (goodVsExcellentTrigger) {
            goodVsExcellentTrigger.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        }
        document.querySelectorAll('.stock-incoming-used-note__grade-link').forEach(function (btn) {
            btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        });
    }

    function openGoodVsExcellentOverlay() {
        if (!goodVsExcellentOverlay) return;
        goodVsExcellentOverlay.hidden = false;
        goodVsExcellentOverlay.setAttribute('aria-hidden', 'false');
        setGoodVsExcellentExpanded(true);
        document.body.style.overflow = 'hidden';
    }

    function closeGoodVsExcellentOverlay() {
        if (!goodVsExcellentOverlay) return;
        goodVsExcellentOverlay.hidden = true;
        goodVsExcellentOverlay.setAttribute('aria-hidden', 'true');
        setGoodVsExcellentExpanded(false);
        const stockOverlay = document.getElementById('stock-overlay');
        const softOverlay = document.getElementById('soft-unlocked-overlay');
        if (
            (!stockOverlay || stockOverlay.hidden) &&
            (!softOverlay || softOverlay.hidden)
        ) {
            document.body.style.overflow = '';
        }
    }

    if (goodVsExcellentTrigger && goodVsExcellentOverlay) {
        goodVsExcellentTrigger.addEventListener('click', openGoodVsExcellentOverlay);
        goodVsExcellentOverlay.addEventListener('click', function (e) {
            if (e.target === goodVsExcellentOverlay) closeGoodVsExcellentOverlay();
        });
        if (goodVsExcellentClose) {
            goodVsExcellentClose.addEventListener('click', closeGoodVsExcellentOverlay);
        }
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

    // Payment Methods popup
    const paymentMethodsTrigger = document.getElementById('payment-methods-trigger');
    const paymentMethodsOverlay = document.getElementById('payment-methods-overlay');
    const paymentMethodsClose = paymentMethodsOverlay && paymentMethodsOverlay.querySelector('.extracare-close');
    if (paymentMethodsTrigger && paymentMethodsOverlay) {
        function openPaymentMethods() {
            paymentMethodsOverlay.hidden = false;
            paymentMethodsOverlay.setAttribute('aria-hidden', 'false');
            paymentMethodsTrigger.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        }
        function closePaymentMethods() {
            paymentMethodsOverlay.hidden = true;
            paymentMethodsOverlay.setAttribute('aria-hidden', 'true');
            paymentMethodsTrigger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
        paymentMethodsTrigger.addEventListener('click', openPaymentMethods);
        paymentMethodsOverlay.addEventListener('click', function(e) {
            if (e.target === paymentMethodsOverlay) closePaymentMethods();
        });
        if (paymentMethodsClose) paymentMethodsClose.addEventListener('click', closePaymentMethods);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !paymentMethodsOverlay.hidden) closePaymentMethods();
        });
    }

    const softUnlockedOverlay = document.getElementById('soft-unlocked-overlay');
    const softUnlockedClose =
        softUnlockedOverlay && softUnlockedOverlay.querySelector('.extracare-close');
    function openSoftUnlockedOverlay() {
        if (!softUnlockedOverlay) return;
        softUnlockedOverlay.hidden = false;
        softUnlockedOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    function closeSoftUnlockedOverlay() {
        if (!softUnlockedOverlay) return;
        softUnlockedOverlay.hidden = true;
        softUnlockedOverlay.setAttribute('aria-hidden', 'true');
        const stockOverlay = document.getElementById('stock-overlay');
        if (!stockOverlay || stockOverlay.hidden) {
            document.body.style.overflow = '';
        }
    }
    if (softUnlockedOverlay) {
        softUnlockedOverlay.addEventListener('click', function(e) {
            if (e.target === softUnlockedOverlay) closeSoftUnlockedOverlay();
        });
        if (softUnlockedClose) softUnlockedClose.addEventListener('click', closeSoftUnlockedOverlay);
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
        { model: 'Pixel 7 Pro', storage: '256GB', condition: 'New', code: 'A2656' },
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
        { model: 'Pixel 8 Pro', storage: '128GB', condition: 'New', code: 'B0025' },
        { model: 'Pixel 8 Pro', storage: '128GB', condition: 'Used', code: 'B0979' },
        { model: 'Pixel 8 Pro', storage: '256GB', condition: 'New', code: 'A7219' },
        { model: 'Pixel 8 Pro', storage: '256GB', condition: 'Used', code: 'A9124' },
        { model: 'Pixel 8 Pro', storage: '512GB', condition: 'New', code: 'B1962' },
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
        { model: 'Pixel 9 Pro', storage: '128GB', condition: 'New', code: 'B2174' },
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
        { model: 'Pixel 10 Pro Fold', storage: '512GB', condition: 'New', code: 'B2825' },
        { model: 'Pixel 10 Pro Fold', storage: '512GB', condition: 'Used', code: 'B2824' },
        { model: 'Pixel 10a', storage: '128GB', condition: 'New', code: 'B2030' },
        { model: 'Pixel 10a', storage: '128GB', condition: 'Used', code: 'B2810' },
        { model: 'Pixel 10a', storage: '256GB', condition: 'New', code: 'B2171' },
        { model: 'Pixel 10a', storage: '256GB', condition: 'Used', code: 'B2811' }
    ];

    const pricingListEl = document.getElementById('pricing-list');
    const pricingEmptyStateEl = document.getElementById('pricing-empty-state');
    const pricingLoadingEl = document.getElementById('pricing-loading');
    const stockOverlayEl = document.getElementById('stock-overlay');
    const stockModalTitleEl = document.getElementById('stock-modal-title');
    const stockModalBodyEl = document.getElementById('stock-modal-body');
    const stockModalCloseEl =
        stockOverlayEl && stockOverlayEl.querySelector('.stock-modal-close');

    function closeStockModal() {
        if (!stockOverlayEl) return;
        stockOverlayEl.hidden = true;
        stockOverlayEl.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        document.querySelectorAll(
            '.view-stock-link[aria-expanded="true"], .model-title-toggle--has-stock[aria-expanded="true"]'
        ).forEach(function (btn) {
            btn.setAttribute('aria-expanded', 'false');
        });
    }

    if (stockOverlayEl) {
        stockOverlayEl.addEventListener('click', function (e) {
            if (e.target === stockOverlayEl) closeStockModal();
        });
        if (stockModalCloseEl) stockModalCloseEl.addEventListener('click', closeStockModal);
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (softUnlockedOverlay && !softUnlockedOverlay.hidden) {
                closeSoftUnlockedOverlay();
                return;
            }
            if (goodVsExcellentOverlay && !goodVsExcellentOverlay.hidden) {
                closeGoodVsExcellentOverlay();
                return;
            }
            if (!stockOverlayEl.hidden) closeStockModal();
        });
    }

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

    const INVENTORY_STATUS_RANK = {
        'In Stock': 0,
        'Arriving in 1–2 weeks': 1,
        'Arriving in 2–3 weeks': 2,
        'Arriving in 3–4 weeks': 3
    };

    function sortInventoryUnits(units) {
        units.sort(function (a, b) {
            const rankA = INVENTORY_STATUS_RANK[a.availability] ?? 99;
            const rankB = INVENTORY_STATUS_RANK[b.availability] ?? 99;
            if (rankA !== rankB) return rankA - rankB;

            const numA = parseInt(String(a.storage).replace(/\D/g, ''), 10);
            const numB = parseInt(String(b.storage).replace(/\D/g, ''), 10);
            if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
                return numA - numB;
            }

            const newA = /^new/i.test(String(a.condition)) ? 0 : 1;
            const newB = /^new/i.test(String(b.condition)) ? 0 : 1;
            if (newA !== newB) return newA - newB;

            const colorCmp = String(a.color).localeCompare(String(b.color));
            if (colorCmp !== 0) return colorCmp;

            return String(a.grade || '').localeCompare(String(b.grade || ''));
        });
    }

    function buildInventoryByModel(list) {
        const map = new Map();
        if (!Array.isArray(list)) return map;
        list.forEach(function (unit) {
            if (!unit || !unit.model) return;
            if (!map.has(unit.model)) map.set(unit.model, []);
            map.get(unit.model).push(unit);
        });
        map.forEach(function (units) {
            sortInventoryUnits(units);
        });
        return map;
    }

    function normalizeStorage(storage) {
        return String(storage || '').trim().toUpperCase().replace(/\s+/g, '');
    }

    function isNewInventoryCondition(condition) {
        return /^new/i.test(String(condition || ''));
    }

    function getUnitsForVariant(inventoryUnits, variant) {
        if (!inventoryUnits || !inventoryUnits.length) return [];
        const targetStorage = normalizeStorage(variant.storage);
        const wantNew = variant.condition === 'New';
        const matched = inventoryUnits.filter(function (unit) {
            if (normalizeStorage(unit.storage) !== targetStorage) return false;
            const unitIsNew = isNewInventoryCondition(unit.condition);
            return wantNew ? unitIsNew : !unitIsNew;
        });
        sortInventoryUnits(matched);
        return matched;
    }

    function createColorDot(colorName) {
        const catalog = window.PIXEL_CATALOG;
        const info = catalog
            ? catalog.getPixelColorHex(colorName)
            : { hex: '#9aa0a6', light: false };
        const dot = document.createElement('span');
        dot.className = 'color-dot' + (info.light ? ' color-dot--light' : '');
        dot.style.backgroundColor = info.hex;
        dot.setAttribute('aria-hidden', 'true');
        return dot;
    }

    function createConditionSection(type) {
        const section = document.createElement('div');
        section.className = 'model-section model-section--' + type;
        return section;
    }

    function isExcellentGrade(grade) {
        const g = String(grade || '');
        return /excellent/i.test(g) && !/issue/i.test(g);
    }

    function isSoftUnlocked(condition) {
        return /soft/i.test(String(condition || ''));
    }

    function getUnitPrice(basePrice, unit) {
        if (unit.hasIssue) return null;
        let price = basePrice;
        if (isSoftUnlocked(unit.condition)) price -= 4000;
        if (isExcellentGrade(unit.grade)) price += 1000;
        return price;
    }

    function formatPesoPrice(amount) {
        return '₱' + amount.toLocaleString('en-PH');
    }

    function variantHasStockOrArriving(units) {
        return units.some(function (u) {
            const label = String(u.availability || '');
            return label === 'In Stock' || /arriving/i.test(label);
        });
    }

    function getModelStartingPrice(variants) {
        let min = null;
        variants.forEach(function (v) {
            const p =
                v.price !== null && v.price !== undefined && v.price !== ''
                    ? typeof v.price === 'number'
                        ? v.price
                        : Number(v.price)
                    : null;
            if (p !== null && !Number.isNaN(p) && (min === null || p < min)) {
                min = p;
            }
        });
        return min;
    }

    function createSectionHeading(label) {
        const heading = document.createElement('h3');
        heading.className = 'model-section__heading';
        heading.textContent = label;
        return heading;
    }

    function parseAvailabilityDisplay(availability) {
        const label = String(availability || '').trim();
        if (label === 'In Stock') {
            return { pill: 'In Stock', eta: null, type: 'stock' };
        }
        if (/arriving/i.test(label)) {
            const eta = label
                .replace(/^Arriving in\s*/i, '')
                .replace(/–/g, '-')
                .replace(/\bwk\b\.?/gi, 'weeks')
                .trim();
            return { pill: 'Incoming', eta: eta, type: 'incoming' };
        }
        return { pill: label, eta: null, type: 'other' };
    }

    function createStatusPill(availability) {
        const info = parseAvailabilityDisplay(availability);
        const wrap = document.createElement('span');
        wrap.className = 'inventory-unit-status';

        const pill = document.createElement('span');
        pill.className = 'status-pill status-pill--' + info.type;
        pill.textContent = info.pill;
        wrap.appendChild(pill);

        if (info.eta) {
            const etaEl = document.createElement('span');
            etaEl.className = 'status-pill-eta';
            etaEl.textContent = info.eta;
            wrap.appendChild(etaEl);
        }
        return wrap;
    }

    function getGradeChipMeta(unit) {
        if (unit.hasIssue) {
            return { label: 'Issue', className: 'tag--issue' };
        }
        const grade = String(unit.grade || '').trim();
        if (/excellent/i.test(grade)) {
            return { label: 'Excellent', className: 'tag--excellent' };
        }
        if (/very\s*good/i.test(grade)) {
            return { label: 'Very Good', className: 'tag--very-good' };
        }
        if (/^good$/i.test(grade) || (/good/i.test(grade) && !/very/i.test(grade))) {
            return { label: 'Good', className: 'tag--good' };
        }
        if (/fair/i.test(grade)) {
            return { label: 'Fair', className: 'tag--fair' };
        }
        if (grade) {
            return { label: grade, className: 'tag--default' };
        }
        return null;
    }

    function createConditionBadge(sectionType) {
        const badge = document.createElement('span');
        if (sectionType === 'new') {
            badge.className = 'tag tag--condition-new';
            badge.textContent = 'New';
        } else {
            badge.className = 'tag tag--condition-used';
            badge.textContent = 'Used';
        }
        return badge;
    }

    // Match Grist STORAGE Choice fill/text colors (Master_List.STORAGE choiceOptions).
    function createStorageBadge(storage) {
        const label = String(storage || '').trim() || '—';
        const key = label.replace(/\s+/g, '').toUpperCase();
        const badge = document.createElement('span');
        badge.className = 'tag tag--storage';
        if (key === '64GB') badge.classList.add('tag--storage-64');
        else if (key === '128GB') badge.classList.add('tag--storage-128');
        else if (key === '256GB') badge.classList.add('tag--storage-256');
        else if (key === '512GB') badge.classList.add('tag--storage-512');
        else badge.classList.add('tag--storage-default');
        badge.textContent = label;
        return badge;
    }

    function createSoftUnlockedBadge() {
        const badge = document.createElement('span');
        badge.className = 'tag tag--soft tag--soft-with-help';

        const label = document.createElement('span');
        label.className = 'tag--soft-label';
        label.textContent = 'Soft';
        badge.appendChild(label);

        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'tag-help-trigger';
        helpBtn.setAttribute('aria-label', 'What does Soft unlocked mean?');
        helpBtn.textContent = '?';
        helpBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openSoftUnlockedOverlay();
        });
        badge.appendChild(helpBtn);
        return badge;
    }

    function createGradeChip(unit) {
        const meta = getGradeChipMeta(unit);
        if (!meta) return null;
        const chip = document.createElement('span');
        chip.className = 'tag ' + meta.className;
        chip.textContent = meta.label;
        return chip;
    }

    function getUsedConditionExtra(unit) {
        const match = String(unit.condition || '')
            .trim()
            .match(/^used,\s*(.+)$/i);
        if (!match) return '';
        const extra = match[1].trim();
        return /^factory$/i.test(extra) ? '' : extra;
    }

    function getUnitExtraLabel(unit, sectionType) {
        const usedExtra = sectionType === 'used' ? getUsedConditionExtra(unit) : '';
        if (usedExtra) return usedExtra;
        if (
            sectionType === 'new' &&
            unit.condition &&
            !/^new,\s*factory$/i.test(String(unit.condition).trim())
        ) {
            return String(unit.condition).trim();
        }
        return '';
    }

    function getUnitMergeKey(unit, sectionType, basePrice) {
        const gradeMeta = getGradeChipMeta(unit);
        const gradeKey = gradeMeta ? gradeMeta.label : '';
        let priceKey = 'no-price';
        if (unit.hasIssue) {
            priceKey = 'issue';
        } else if (
            basePrice != null &&
            (sectionType === 'used' || isSoftUnlocked(unit.condition))
        ) {
            priceKey = String(getUnitPrice(basePrice, unit));
        }
        return [
            String(unit.color || '').trim().toLowerCase(),
            gradeKey,
            getUnitExtraLabel(unit, sectionType).toLowerCase(),
            priceKey,
            String(unit.availability || '').trim()
        ].join('|');
    }

    function mergeDuplicateUnits(units, sectionType, basePrice) {
        const merged = [];
        const indexByKey = new Map();
        units.forEach(function (unit) {
            const key = getUnitMergeKey(unit, sectionType, basePrice);
            if (indexByKey.has(key)) {
                merged[indexByKey.get(key)].quantity += 1;
            } else {
                indexByKey.set(key, merged.length);
                merged.push({ unit: unit, quantity: 1, mergeKey: key });
            }
        });
        return merged;
    }

    function sortTableRowData(rows) {
        rows.sort(function (a, b) {
            const rankA = INVENTORY_STATUS_RANK[a.entry.unit.availability] ?? 99;
            const rankB = INVENTORY_STATUS_RANK[b.entry.unit.availability] ?? 99;
            if (rankA !== rankB) return rankA - rankB;

            const storA = parseInt(String(a.storage).replace(/\D/g, ''), 10) || 0;
            const storB = parseInt(String(b.storage).replace(/\D/g, ''), 10) || 0;
            if (storA !== storB) return storA - storB;

            const colorA = String(a.entry.unit.color || '').toLowerCase();
            const colorB = String(b.entry.unit.color || '').toLowerCase();
            if (colorA !== colorB) return colorA.localeCompare(colorB);

            return String(a.entry.unit.grade || '').localeCompare(String(b.entry.unit.grade || ''));
        });
    }

    function sortRestockRows(rows) {
        rows.sort(function (a, b) {
            const storA = parseInt(String(a.storage).replace(/\D/g, ''), 10) || 0;
            const storB = parseInt(String(b.storage).replace(/\D/g, ''), 10) || 0;
            return storA - storB;
        });
    }

    function createPlaceholderCell(className) {
        const cell = document.createElement('div');
        cell.className = className;
        cell.textContent = '—';
        return cell;
    }

    function createInventoryTableHeader() {
        const header = document.createElement('div');
        header.className = 'inventory-table__header inventory-unit-row';
        ['Storage', 'Color', 'Condition', 'Price', 'Availability'].forEach(function (label) {
            const cell = document.createElement('div');
            cell.className = 'inventory-table__th';
            cell.textContent = label;
            header.appendChild(cell);
        });
        return header;
    }

    function createInventoryUnitRow(entry, storage, sectionType, basePrice) {
        const unit = entry.unit;
        const rowEl = document.createElement('div');
        rowEl.className = 'inventory-unit-row';

        const storageCol = document.createElement('div');
        storageCol.className = 'inventory-unit-storage-col';
        storageCol.appendChild(createStorageBadge(storage));
        rowEl.appendChild(storageCol);

        const colorCol = document.createElement('div');
        colorCol.className = 'inventory-unit-color-col';
        if (unit.color) {
            colorCol.appendChild(createColorDot(unit.color));
            const colorName = document.createElement('span');
            colorName.className = 'inventory-unit-color-name';
            colorName.textContent = unit.color;
            colorCol.appendChild(colorName);
        } else {
            colorCol.textContent = '—';
            colorCol.classList.add('inventory-unit-color-col--empty');
        }
        rowEl.appendChild(colorCol);

        const conditionCol = document.createElement('div');
        conditionCol.className = 'inventory-unit-condition-col';
        conditionCol.appendChild(createConditionBadge(sectionType));
        if (sectionType === 'used') {
            const gradeChip = createGradeChip(unit);
            if (gradeChip) conditionCol.appendChild(gradeChip);
        }
        if (isSoftUnlocked(unit.condition)) {
            conditionCol.appendChild(createSoftUnlockedBadge());
        }
        if (entry.quantity > 1) {
            conditionCol.appendChild(createQuantityBadge(entry.quantity));
        }
        rowEl.appendChild(conditionCol);

        const priceEl = document.createElement('div');
        priceEl.className = 'inventory-unit-price';
        if (unit.hasIssue) {
            priceEl.appendChild(createInquireLink());
        } else {
            const rowPrice = getRowUnitPrice(basePrice, unit, sectionType);
            if (rowPrice != null) {
                priceEl.textContent = formatPesoPrice(rowPrice);
            }
        }
        rowEl.appendChild(priceEl);
        rowEl.appendChild(createStatusPill(unit.availability));
        return rowEl;
    }

    function createRestockingRow(storage, price, sectionType) {
        const rowEl = document.createElement('div');
        rowEl.className = 'inventory-unit-row inventory-unit-row--restock';

        const storageCol = document.createElement('div');
        storageCol.className = 'inventory-unit-storage-col';
        storageCol.appendChild(createStorageBadge(storage));
        rowEl.appendChild(storageCol);

        rowEl.appendChild(createPlaceholderCell('inventory-unit-color-col inventory-unit-color-col--empty'));

        const conditionCol = document.createElement('div');
        conditionCol.className = 'inventory-unit-condition-col';
        conditionCol.appendChild(createConditionBadge(sectionType));
        rowEl.appendChild(conditionCol);

        const priceEl = document.createElement('div');
        priceEl.className = 'inventory-unit-price';
        priceEl.textContent = formatPesoPrice(price);
        rowEl.appendChild(priceEl);

        const statusWrap = document.createElement('span');
        statusWrap.className = 'inventory-unit-status';
        const pill = document.createElement('span');
        pill.className = 'status-pill status-pill--restock';
        pill.textContent = 'Restocking soon';
        statusWrap.appendChild(pill);
        rowEl.appendChild(statusWrap);
        return rowEl;
    }

    function createInventoryTable(rowData, restockRows, sectionType) {
        const table = document.createElement('div');
        table.className = 'inventory-table';
        table.appendChild(createInventoryTableHeader());

        const body = document.createElement('div');
        body.className = 'inventory-table__body';
        rowData.forEach(function (item) {
            body.appendChild(
                createInventoryUnitRow(
                    item.entry,
                    item.storage,
                    item.sectionType || sectionType,
                    item.basePrice
                )
            );
        });
        restockRows.forEach(function (item) {
            body.appendChild(createRestockingRow(item.storage, item.price, sectionType));
        });
        table.appendChild(body);
        return table;
    }

    function openStockModal(modelName, variants, inventoryUnits, triggerBtn) {
        if (!stockOverlayEl || !stockModalTitleEl || !stockModalBodyEl) return;

        stockModalTitleEl.textContent = modelName + ' — Available Stock';
        stockModalBodyEl.innerHTML = '';
        stockModalBodyEl.appendChild(createStockPanelContent(modelName, variants, inventoryUnits));

        stockOverlayEl.hidden = false;
        stockOverlayEl.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        document.querySelectorAll(
            '.view-stock-link[aria-expanded="true"], .model-title-toggle--has-stock[aria-expanded="true"]'
        ).forEach(function (btn) {
            btn.setAttribute('aria-expanded', 'false');
        });
        if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');
    }

    function isIncomingAvailability(availability) {
        const label = String(availability || '').trim();
        return label !== 'In Stock' && /arriving/i.test(label);
    }

    function hasIncomingUsedRows(unitRows) {
        return unitRows.some(function (row) {
            return row.sectionType === 'used' && isIncomingAvailability(row.entry.unit.availability);
        });
    }

    function createStockIncomingUsedNote() {
        const note = document.createElement('div');
        note.className = 'stock-incoming-used-note';
        note.setAttribute('role', 'note');

        const line1 = document.createElement('span');
        line1.className = 'stock-incoming-used-note__line';
        line1.appendChild(document.createTextNode('Incoming '));
        const usedBadge = document.createElement('span');
        usedBadge.className = 'tag tag--condition-used';
        usedBadge.textContent = 'Used';
        line1.appendChild(usedBadge);
        line1.appendChild(document.createTextNode(' units are priced at Good condition.'));

        const line2 = document.createElement('span');
        line2.className = 'stock-incoming-used-note__line';
        line2.appendChild(document.createTextNode('Final price may be ₱1,000 higher if graded as '));
        const excellentBadge = document.createElement('span');
        excellentBadge.className = 'tag tag--excellent';
        excellentBadge.textContent = 'Excellent';
        line2.appendChild(excellentBadge);
        line2.appendChild(document.createTextNode(' after arrival.'));

        note.appendChild(line1);
        note.appendChild(line2);
        return note;
    }

    function createStockPanelContent(modelName, variants, inventoryUnits) {
        const panel = document.createElement('div');
        panel.className = 'stock-panel';

        const newVariants = variants.filter(function (v) {
            return v.condition === 'New';
        });
        const usedVariants = variants.filter(function (v) {
            return v.condition === 'Used';
        });

        const unitRows = [];
        if (newVariants.length) {
            unitRows.push.apply(
                unitRows,
                collectVariantTableData(newVariants, inventoryUnits, 'new').unitRows
            );
        }
        if (usedVariants.length) {
            unitRows.push.apply(
                unitRows,
                collectVariantTableData(usedVariants, inventoryUnits, 'used').unitRows
            );
        }

        sortCombinedStockRows(unitRows);

        if (unitRows.length) {
            if (hasIncomingUsedRows(unitRows)) {
                panel.appendChild(createStockIncomingUsedNote());
            }
            panel.appendChild(createInventoryTable(unitRows, [], 'new'));
        } else {
            const empty = document.createElement('p');
            empty.className = 'stock-modal-empty';
            empty.textContent = 'No units available right now.';
            panel.appendChild(empty);
        }

        return panel;
    }

    function sortCombinedStockRows(rows) {
        rows.sort(function (a, b) {
            const rankA = INVENTORY_STATUS_RANK[a.entry.unit.availability] ?? 99;
            const rankB = INVENTORY_STATUS_RANK[b.entry.unit.availability] ?? 99;
            if (rankA !== rankB) return rankA - rankB;

            const condA = a.sectionType === 'new' ? 0 : 1;
            const condB = b.sectionType === 'new' ? 0 : 1;
            if (condA !== condB) return condA - condB;

            const storA = parseInt(String(a.storage).replace(/\D/g, ''), 10) || 0;
            const storB = parseInt(String(b.storage).replace(/\D/g, ''), 10) || 0;
            if (storA !== storB) return storA - storB;

            const colorA = String(a.entry.unit.color || '').toLowerCase();
            const colorB = String(b.entry.unit.color || '').toLowerCase();
            if (colorA !== colorB) return colorA.localeCompare(colorB);

            return String(a.entry.unit.grade || '').localeCompare(String(b.entry.unit.grade || ''));
        });
    }

    function modelHasStockUnits(inventoryUnits) {
        if (!inventoryUnits || !inventoryUnits.length) return false;
        return inventoryUnits.some(function (u) {
            const label = String(u.availability || '');
            return label === 'In Stock' || /arriving/i.test(label);
        });
    }

    function createModelGroupElement(modelName, variants, inventoryUnits) {
        inventoryUnits = inventoryUnits || [];

        const catalog = window.PIXEL_CATALOG;
        const imageUrl = catalog
            ? catalog.getModelImageUrl(modelName)
            : '/images/models/pixel-default.svg';

        const groupEl = document.createElement('section');
        groupEl.className = 'model-group';

        const headerEl = document.createElement('div');
        headerEl.className = 'model-header';

        const bodyEl = document.createElement('div');
        bodyEl.className = 'model-body';
        bodyEl.hidden = true;
        bodyEl.id = 'model-body-' + modelName.replace(/\s+/g, '-').toLowerCase();

        const headerText = document.createElement('div');
        headerText.className = 'model-header-text';

        const hasStock = modelHasStockUnits(inventoryUnits);

        const titleToggle = document.createElement('button');
        titleToggle.type = 'button';
        titleToggle.className = 'model-title-toggle';
        titleToggle.textContent = modelName;

        function isModelBodyExpanded() {
            return !bodyEl.hidden;
        }

        function setModelBodyExpanded(expanded) {
            bodyEl.hidden = !expanded;
            groupEl.classList.toggle('is-open', expanded);
            if (!hasStock) {
                titleToggle.setAttribute('aria-expanded', String(expanded));
            }
        }

        function toggleModelBody() {
            setModelBodyExpanded(!isModelBodyExpanded());
        }

        function openStockFromHeader(triggerEl) {
            openStockModal(modelName, variants, inventoryUnits, triggerEl);
        }

        if (hasStock) {
            titleToggle.classList.add('model-title-toggle--has-stock');
            titleToggle.setAttribute('aria-haspopup', 'dialog');
            titleToggle.setAttribute('aria-expanded', 'false');
            titleToggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                openStockFromHeader(titleToggle);
            });
        } else {
            titleToggle.setAttribute('aria-expanded', 'false');
            titleToggle.setAttribute('aria-controls', bodyEl.id);
            titleToggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleModelBody();
            });
        }

        const imageEl = document.createElement('img');
        imageEl.className = 'model-header__image';
        imageEl.src = imageUrl;
        imageEl.alt = '';
        imageEl.width = 44;
        imageEl.height = 44;
        imageEl.loading = 'lazy';
        imageEl.decoding = 'async';
        imageEl.setAttribute('role', 'button');
        imageEl.tabIndex = 0;
        imageEl.setAttribute('aria-label', hasStock ? 'View ' + modelName + ' stock' : 'Show ' + modelName + ' prices');
        imageEl.setAttribute('aria-expanded', 'false');
        if (hasStock) {
            imageEl.setAttribute('aria-haspopup', 'dialog');
        } else {
            imageEl.setAttribute('aria-controls', bodyEl.id);
        }
        imageEl.addEventListener('error', function () {
            imageEl.src = '/images/models/pixel-default.svg';
        });

        imageEl.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (hasStock) {
                openStockFromHeader(imageEl);
                return;
            }
            toggleModelBody();
            imageEl.setAttribute('aria-expanded', String(isModelBodyExpanded()));
        });
        imageEl.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            if (hasStock) {
                openStockFromHeader(imageEl);
                return;
            }
            toggleModelBody();
            imageEl.setAttribute('aria-expanded', String(isModelBodyExpanded()));
        });

        headerText.appendChild(titleToggle);

        if (hasStock) {
            const viewStockBtn = document.createElement('button');
            viewStockBtn.type = 'button';
            viewStockBtn.className = 'view-stock-link';
            viewStockBtn.textContent = 'View stock';
            viewStockBtn.setAttribute('aria-haspopup', 'dialog');
            viewStockBtn.setAttribute('aria-expanded', 'false');
            viewStockBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                openStockFromHeader(viewStockBtn);
            });
            headerText.appendChild(viewStockBtn);
        } else {
            const restockBadge = document.createElement('span');
            restockBadge.className = 'model-restock-badge';
            restockBadge.textContent = 'Restocking soon';
            headerText.appendChild(restockBadge);
        }

        headerEl.appendChild(imageEl);
        headerEl.appendChild(headerText);

        variants.forEach(function (variant) {
            const hasPrice =
                variant.price !== null && variant.price !== undefined && variant.price !== '';
            const priceNum =
                hasPrice && typeof variant.price === 'number'
                    ? variant.price
                    : hasPrice
                      ? Number(variant.price)
                      : null;

            if (!hasPrice || priceNum === null || Number.isNaN(priceNum)) {
                return;
            }

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
                'tag ' +
                (variant.condition === 'New' ? 'tag--condition-new' : 'tag--condition-used');
            conditionTag.textContent = variant.condition;

            tagsEl.appendChild(conditionTag);
            mainEl.appendChild(metaEl);
            mainEl.appendChild(tagsEl);

            const priceEl = document.createElement('div');
            priceEl.className = 'variant-price';
            if (variant.condition === 'Used') {
                const fromLabel = document.createElement('span');
                fromLabel.className = 'variant-price-from';
                fromLabel.textContent = 'from ';
                const amount = document.createElement('span');
                amount.className = 'variant-price-amount';
                amount.textContent = formatPesoPrice(priceNum);
                priceEl.appendChild(fromLabel);
                priceEl.appendChild(amount);
            } else {
                priceEl.textContent = formatPesoPrice(priceNum);
            }

            rowEl.appendChild(mainEl);
            rowEl.appendChild(priceEl);
            bodyEl.appendChild(rowEl);
        });

        groupEl.appendChild(headerEl);
        groupEl.appendChild(bodyEl);

        return groupEl;
    }

    function collectVariantTableData(variants, inventoryUnits, sectionType) {
        const unitRows = [];
        const restockRows = [];

        variants.forEach(function (variant) {
            const hasPrice =
                variant.price !== null && variant.price !== undefined && variant.price !== '';
            const priceNum =
                hasPrice && typeof variant.price === 'number'
                    ? variant.price
                    : hasPrice
                      ? Number(variant.price)
                      : null;
            if (!hasPrice || priceNum === null || Number.isNaN(priceNum)) return;

            const variantUnits = getUnitsForVariant(inventoryUnits, variant);
            const hasUnits = variantHasStockOrArriving(variantUnits);

            if (!hasUnits) {
                restockRows.push({ storage: variant.storage, price: priceNum });
                return;
            }

            const merged = mergeDuplicateUnits(variantUnits, sectionType, priceNum);
            sortMergedUnitRows(merged);
            merged.forEach(function (entry) {
                unitRows.push({
                    entry: entry,
                    storage: variant.storage,
                    basePrice: priceNum,
                    sectionType: sectionType
                });
            });
        });

        sortTableRowData(unitRows);
        sortRestockRows(restockRows);
        return { unitRows: unitRows, restockRows: restockRows };
    }

    function renderConditionInventory(sectionBody, variants, inventoryUnits, sectionType, options) {
        const includeRestock = !options || options.includeRestock !== false;
        const data = collectVariantTableData(variants, inventoryUnits, sectionType);
        const restockRows = includeRestock ? data.restockRows : [];

        if (data.unitRows.length || restockRows.length) {
            sectionBody.appendChild(
                createInventoryTable(data.unitRows, restockRows, sectionType)
            );
        }
    }

    function createQuantityBadge(qty) {
        const badge = document.createElement('span');
        badge.className = 'unit-qty-badge';
        badge.textContent = '×' + qty;
        badge.setAttribute('aria-label', qty + ' units');
        return badge;
    }

    function createSectionBadge(type) {
        const badge = document.createElement('span');
        badge.className = 'section-badge section-badge--' + type;
        badge.textContent = type === 'new' ? 'New' : 'Used';
        return badge;
    }

    function createModelConditionSection(type) {
        const section = createConditionSection(type);
        const body = document.createElement('div');
        body.className = 'model-section__body';
        section.appendChild(body);
        return { section: section, body: body };
    }

    function getRowUnitPrice(basePrice, unit, sectionType) {
        if (unit.hasIssue || basePrice == null) return null;
        if (sectionType === 'used' || isSoftUnlocked(unit.condition)) {
            return getUnitPrice(basePrice, unit);
        }
        return basePrice;
    }

    function sortMergedUnitRows(mergedRows) {
        mergedRows.sort(function (a, b) {
            const rankA = INVENTORY_STATUS_RANK[a.unit.availability] ?? 99;
            const rankB = INVENTORY_STATUS_RANK[b.unit.availability] ?? 99;
            if (rankA !== rankB) return rankA - rankB;

            const colorA = String(a.unit.color || '').toLowerCase();
            const colorB = String(b.unit.color || '').toLowerCase();
            if (colorA !== colorB) return colorA.localeCompare(colorB);

            const gradeA = String(a.unit.grade || '').toLowerCase();
            const gradeB = String(b.unit.grade || '').toLowerCase();
            return gradeA.localeCompare(gradeB);
        });
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

    function sortModelsList(models) {
        models.sort(function (a, b) {
            const idxA = MODEL_ORDER_NEWEST_TO_OLDEST.indexOf(a.model);
            const idxB = MODEL_ORDER_NEWEST_TO_OLDEST.indexOf(b.model);
            const rankA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
            const rankB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
            return rankA - rankB;
        });
    }

    function buildModelsFromPricingData(pricingData) {
        const variantsByModel = new Map();

        pricingData.forEach(function (item) {
            const hasPrice = item.price !== null && item.price !== undefined && item.price !== '';
            const priceNum =
                hasPrice && typeof item.price === 'number'
                    ? item.price
                    : hasPrice
                      ? Number(item.price)
                      : null;
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

        const models = Array.from(variantsByModel.entries())
            .map(function (entry) {
                const model = entry[0];
                const variants = entry[1];
                variants.sort(function (a, b) {
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
                return { model: model, variants: variants };
            })
            .filter(function (entry) {
                return entry.variants.length > 0;
            });

        sortModelsList(models);
        return models;
    }

    function renderPricingList(pricingData, inventoryByModel) {
        inventoryByModel = inventoryByModel || new Map();
        if (!pricingListEl || !pricingEmptyStateEl) return;

        const models = buildModelsFromPricingData(pricingData);

        if (!models.length) {
            pricingEmptyStateEl.hidden = false;
            pricingListEl.innerHTML = '';
            return;
        }

        pricingEmptyStateEl.hidden = true;
        pricingListEl.innerHTML = '';

        const fragment = document.createDocumentFragment();
        models.forEach(function (entry) {
            const inventoryUnits = inventoryByModel.get(entry.model) || [];
            const groupEl = createModelGroupElement(entry.model, entry.variants, inventoryUnits);
            if (groupEl) fragment.appendChild(groupEl);
        });

        pricingListEl.appendChild(fragment);
    }

    const CACHE_KEY = 'sulitzilla_prices';
    const INVENTORY_CACHE_KEY = 'sulitzilla_inventory';
    const SYNC_CACHE_AT_KEY = 'sulitzilla_sync_at';
    const SERVER_SYNC_AT_KEY = 'sulitzilla_server_sync_at';
    const BROWSER_CACHE_VERSION_KEY = 'sulitzilla_cache_version';
    const BROWSER_CACHE_VERSION = '2';

    function ensureBrowserCacheVersion() {
        try {
            if (localStorage.getItem(BROWSER_CACHE_VERSION_KEY) === BROWSER_CACHE_VERSION) {
                return;
            }
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(INVENTORY_CACHE_KEY);
            localStorage.removeItem(SYNC_CACHE_AT_KEY);
            localStorage.removeItem(SERVER_SYNC_AT_KEY);
            localStorage.removeItem(CACHE_KEY + '_at');
            localStorage.setItem(BROWSER_CACHE_VERSION_KEY, BROWSER_CACHE_VERSION);
        } catch (e) {}
    }

    function readServerSyncAtCache() {
        return localStorage.getItem(SERVER_SYNC_AT_KEY);
    }

    function saveServerSyncAt(syncedAt) {
        if (syncedAt == null || syncedAt === '') return;
        try {
            localStorage.setItem(SERVER_SYNC_AT_KEY, String(syncedAt));
            localStorage.setItem(SYNC_CACHE_AT_KEY, String(syncedAt));
        } catch (e) {}
    }

    async function fetchServerSyncAt() {
        const url = window.GRIST_SYNC_STATUS_URL || '/api/sync-status';
        try {
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) return null;
            const json = await r.json();
            return json && json.syncedAt != null ? String(json.syncedAt) : null;
        } catch (e) {
            return null;
        }
    }

    function getSyncKeyFromUrl() {
        try {
            return new URLSearchParams(window.location.search).get('key') || '';
        } catch (e) {
            return '';
        }
    }

    function withRefreshParam(url, forceRefresh) {
        if (!url || forceRefresh !== true) return url;
        var out = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'refresh=1';
        const key = getSyncKeyFromUrl();
        if (key) out += '&key=' + encodeURIComponent(key);
        return out;
    }

    function readSyncCacheTimestamp() {
        return localStorage.getItem(SYNC_CACHE_AT_KEY) || localStorage.getItem(CACHE_KEY + '_at');
    }

    function saveSyncCache(pricesList, inventoryList, timestamp) {
        try {
            const at = String(timestamp);
            if (Array.isArray(pricesList)) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(pricesList));
            }
            if (Array.isArray(inventoryList)) {
                localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(inventoryList));
            }
            localStorage.setItem(SYNC_CACHE_AT_KEY, at);
            localStorage.setItem(CACHE_KEY + '_at', at);
            localStorage.setItem(BROWSER_CACHE_VERSION_KEY, BROWSER_CACHE_VERSION);
        } catch (e) {}
    }

    function readInventoryCache() {
        try {
            const cached = localStorage.getItem(INVENTORY_CACHE_KEY);
            if (!cached) return [];
            const list = JSON.parse(cached);
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    async function fetchInventoryList(forceRefresh) {
        const url = withRefreshParam(window.GRIST_INVENTORY_URL, forceRefresh);
        if (!url) return [];
        try {
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) return [];
            const json = await r.json();
            const list = Array.isArray(json) ? json : (json && json.data);
            if (Array.isArray(list)) {
                return list;
            }
        } catch (e) {}
        return readInventoryCache();
    }

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
        el.textContent =
            'Prices and stock last updated: ' +
            d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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

    function renderCachedPricingIfAvailable(serverSyncedAt) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const inventoryCached = localStorage.getItem(INVENTORY_CACHE_KEY);
            if (!cached || !inventoryCached) return false;
            const cachedServerAt = readServerSyncAtCache();
            if (!serverSyncedAt || !cachedServerAt || serverSyncedAt !== cachedServerAt) {
                return false;
            }
            const list = JSON.parse(cached);
            const inventoryList = JSON.parse(inventoryCached);
            if (!Array.isArray(list) || !Array.isArray(inventoryList)) return false;
            const data = mergePricesFromList(list);
            const inventoryByModel = buildInventoryByModel(inventoryList);
            setPricingLastUpdated(cachedServerAt);
            renderPricingList(data, inventoryByModel);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function loadPrices(forceRefresh, isBackgroundRefresh) {
        ensureBrowserCacheVersion();
        if (!isBackgroundRefresh) showPricingLoader();

        let data = FALLBACK_PRICING_DATA;
        let inventoryByModel = buildInventoryByModel(readInventoryCache());
        const url = window.GRIST_PRICES_URL;

        if (!url) {
            hidePricingLoader();
            renderPricingList(data, inventoryByModel);
            return;
        }

        let serverSyncAt = null;
        if (!forceRefresh) {
            serverSyncAt = await fetchServerSyncAt();
            if (renderCachedPricingIfAvailable(serverSyncAt)) {
                hidePricingLoader();
                return;
            }
        }

        try {
            const priceUrl = withRefreshParam(url, forceRefresh);
            const pricePromise = fetch(priceUrl, { cache: 'no-store' }).then(function (r) {
                if (!r.ok) return null;
                return r.json();
            });
            const inventoryPromise = fetchInventoryList(forceRefresh);
            const results = await Promise.all([pricePromise, inventoryPromise]);
            const json = results[0];
            const invList = results[1];
            inventoryByModel = buildInventoryByModel(invList);
            const list = json
                ? Array.isArray(json)
                    ? json
                    : json && json.data
                : null;
            const pricesList = Array.isArray(list) && list.length > 0 ? list : null;
            if (!serverSyncAt) {
                serverSyncAt = await fetchServerSyncAt();
            }
            if (pricesList || (Array.isArray(invList) && invList.length > 0)) {
                let pricesToStore = pricesList;
                if (!pricesToStore) {
                    try {
                        const cachedPrices = localStorage.getItem(CACHE_KEY);
                        pricesToStore = cachedPrices ? JSON.parse(cachedPrices) : [];
                    } catch (e) {
                        pricesToStore = [];
                    }
                }
                saveSyncCache(pricesToStore, invList, serverSyncAt || Date.now());
                if (serverSyncAt) saveServerSyncAt(serverSyncAt);
                setPricingLastUpdated(serverSyncAt || Date.now());
            }
            if (pricesList) {
                data = mergePricesFromList(pricesList);
            }
        } catch (e) {
            if (!forceRefresh && renderCachedPricingIfAvailable()) {
                hidePricingLoader();
                return;
            }
        }

        hidePricingLoader();
        renderPricingList(data, inventoryByModel);
    }

    loadPrices(false);

    const refreshBtn = document.getElementById('refresh-prices-btn');
    if (refreshBtn) {
        var showRefresh =
            /[?&]refresh=1/i.test(window.location.search) && !!getSyncKeyFromUrl();
        if (showRefresh) {
            refreshBtn.classList.remove('hidden');
            refreshBtn.setAttribute('aria-hidden', 'false');
        }
        refreshBtn.addEventListener('click', function () {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Updating…';
            loadPrices(true, true).then(function () {
                refreshBtn.disabled = false;
                refreshBtn.textContent = 'Refresh prices & stock';
            });
        });
    }
});

