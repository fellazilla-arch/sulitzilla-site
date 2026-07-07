/**
 * Pixel model images and official-ish color swatches for the price list UI.
 */
(function (global) {
    /** Front+back product renders (160–216px). After changes run: images/models/compress-models.sh */
    const MODEL_IMAGE_FILES = {
        'Pixel 10a': 'pixel-10a.jpg',
        'Pixel 10': 'pixel-10.png',
        'Pixel 10 Pro': 'pixel-10-pro.jpg',
        'Pixel 10 Pro XL': 'pixel-10-pro-xl.jpg',
        'Pixel 10 Pro Fold': 'pixel-10-pro-fold.png',
        'Pixel 9a': 'pixel-9a.png',
        'Pixel 9': 'pixel-9.png',
        'Pixel 9 Pro': 'pixel-9-pro.jpg',
        'Pixel 9 Pro XL': 'pixel-9-pro-xl.jpg',
        'Pixel 9 Pro Fold': 'pixel-9-pro-fold.jpg',
        'Pixel 8a': 'pixel-8a.jpg',
        'Pixel 8': 'pixel-8.png',
        'Pixel 8 Pro': 'pixel-8-pro.jpg',
        'Pixel Fold': 'pixel-fold.png',
        'Pixel 7a': 'pixel-7a.jpg',
        'Pixel 7': 'pixel-7.jpg',
        'Pixel 7 Pro': 'pixel-7-pro.jpg',
        'Pixel 6a': 'pixel-6a.jpg',
        'Pixel 6': 'pixel-6.jpg',
        'Pixel 6 Pro': 'pixel-6-pro.jpg',
        'Pixel 5a': 'pixel-5a.jpg',
        'Pixel 5': 'pixel-5.jpg',
        'Pixel 4a': 'pixel-4a.jpg',
        'Pixel 4a 5G': 'pixel-4a-5g.jpg',
        'Pixel 4': 'pixel-4.jpg',
        'Pixel 4 XL': 'pixel-4-xl.jpg',
        'Pixel 3a': 'pixel-3a.jpg',
        'Pixel 3a XL': 'pixel-3a-xl.jpg',
        'Pixel 3': 'pixel-3.jpg',
        'Pixel 3 XL': 'pixel-3-xl.jpg',
        'Pixel 2': 'pixel-2.jpg',
        'Pixel 2 XL': 'pixel-2-xl.png'
    };

    function modelToSlug(modelName) {
        return String(modelName || '')
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    function getModelImageUrl(modelName) {
        const file = MODEL_IMAGE_FILES[modelName];
        if (file) {
            return '/images/models/' + file;
        }
        return '/images/models/pixel-default.svg';
    }

    /**
     * Google Pixel marketing color names → hex swatches.
     * Tuned from Google product renders / store imagery (e.g. Pixel 10 Indigo ≈ #0A84FF).
     */
    const PIXEL_COLOR_HEX = {
        // Neutrals & blacks
        obsidian: '#1c1d21',
        'stormy black': '#1a1a1e',
        'just black': '#1a1a1a',
        'mostly black': '#242428',
        'true black': '#111111',
        'space black': '#18181c',
        black: '#1a1a1a',
        charcoal: '#3c3c40',
        'volcanic gray': '#5c5c64',
        'stone gray': '#9a9aa4',
        'marble gray': '#b4b4bc',
        zeroone: '#1e1e24',

        // Whites & creams
        porcelain: '#f2ede6',
        'clearly white': '#f4f2ec',
        white: '#f5f5f5',
        snow: '#f6f7f9',
        chalk: '#ece8e0',
        cream: '#f0e8d8',
        'cloudy white': '#ececec',
        frost: '#e6eef6',

        // Pixel 10 family
        indigo: '#0a84ff',
        lemongrass: '#e4e8a0',
        limoncello: '#eceaa0',
        moonstone: '#a8b2c4',
        jade: '#6b8f7a',

        // Blues
        bay: '#5a8ca8',
        'bay blue': '#4a7c9c',
        'coastal blue': '#5a90b0',
        'icy blue': '#c8dce8',
        'serene blue': '#88b0c8',
        'kinda blue': '#6a98b8',
        sea: '#4a8090',
        blue: '#3a72b8',
        green: '#5a9870',
        'barely blue': '#b8d4f0',
        aqua: '#78c8d8',

        // Greens
        mint: '#b8e8d4',
        'mint green': '#b0dcc8',
        'fresh mint': '#b8dcc8',
        'gentle mint': '#c0dcd0',
        'soft sage': '#a8b8a8',
        'sage green': '#98a890',
        sage: '#9aaa98',
        'sorta sage': '#a0b0a0',
        'sorta seafoam': '#98c0b0',
        'forest green': '#4a6850',
        'abyss green': '#3a5850',
        wintergreen: '#a4c4b4',
        pistachio: '#b0c898',

        // Pinks, roses, berries
        berry: '#d88ca0',
        'super berry': '#c86888',
        'cherry berry burst': '#c84868',
        'watermelon burst': '#e86878',
        'natural berry': '#a84868',
        peony: '#e8b0c4',
        rose: '#e8a0b0',
        'rose quartz': '#e8c4c8',
        'rose gold': '#d8b0a8',
        'not pink': '#e8b8c4',
        'sorta pink': '#e8c0c8',
        'hot pink': '#e868a0',
        'pink sand': '#e8c0b8',
        'pink moon': '#d8b0c0',
        'desert rose': '#d8a098',
        coral: '#e89888',
        'sorta coral': '#e89080',
        'kinda coral': '#e89080',
        'could be coral': '#e89080',

        // Purples & lavenders
        lavender: '#bfa8d0',
        iris: '#7b6ba8',
        purple: '#8a68a8',
        'light purple': '#c8b0d8',

        // Browns, taupes, hazels
        hazel: '#a08878',
        walnut: '#8a6848',
        taupe: '#a89888',
        beige: '#d8c8b0',
        fog: '#a8b8c4',

        // Yellows & golds
        gold: '#d8c070',
        'oh so orange': '#e89050',
        'sorta sunny': '#e8d888',

        // Reds
        red: '#c84848',

        // Grays / silver
        silver: '#c8ccd0',
        'polished silver': '#d0d4d8',
        'sorta smoky': '#8a8a90',
        'sorta smoky gray': '#8a8a90',
        'midnight green': '#4a5a50',

        // Pixel 8a / older aliases
        aloe: '#3c6e28',
        bayou: '#4a6860'
    };

    function isLightColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return 0.299 * r + 0.587 * g + 0.114 * b > 186;
    }

    function getPixelColorHex(colorName) {
        const raw = String(colorName || '').trim();
        if (!raw) return { hex: '#9aa0a6', light: false };

        const lower = raw.toLowerCase();
        if (PIXEL_COLOR_HEX[lower]) {
            const hex = PIXEL_COLOR_HEX[lower];
            return { hex: hex, light: isLightColor(hex) };
        }

        const parts = lower.split(/[\/|•,]+/).map(function (s) {
            return s.trim();
        }).filter(Boolean);

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (PIXEL_COLOR_HEX[part]) {
                const hex = PIXEL_COLOR_HEX[part];
                return { hex: hex, light: isLightColor(hex) };
            }
        }

        const keys = Object.keys(PIXEL_COLOR_HEX).sort(function (a, b) {
            return b.length - a.length;
        });
        for (let j = 0; j < keys.length; j++) {
            const key = keys[j];
            if (lower.includes(key)) {
                const hex = PIXEL_COLOR_HEX[key];
                return { hex: hex, light: isLightColor(hex) };
            }
        }

        return { hex: '#9aa0a6', light: false };
    }

    global.PIXEL_CATALOG = {
        MODEL_IMAGE_FILES: MODEL_IMAGE_FILES,
        modelToSlug: modelToSlug,
        getModelImageUrl: getModelImageUrl,
        getPixelColorHex: getPixelColorHex
    };
})(typeof window !== 'undefined' ? window : globalThis);
