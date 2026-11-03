/**
 * Per-unit extras on stock rows: the unit code and the video badge.
 * Expects units shaped like /api/inventory rows ({ code, condition, availability, video }).
 */
(function () {
    function createUnitCodeLabel(code) {
        const value = String(code || '').trim();
        if (!value) return null;
        const label = document.createElement('span');
        label.className = 'unit-code';
        label.title = 'Mention this code when reserving';
        label.appendChild(document.createTextNode('Code '));
        const valueEl = document.createElement('span');
        valueEl.className = 'unit-code__value';
        valueEl.textContent = value;
        label.appendChild(valueEl);
        return label;
    }

    /** Videos are only shown for used units that are in stock. */
    function unitShowsVideo(unit) {
        if (!unit) return false;
        if (/^new/i.test(String(unit.condition || ''))) return false;
        if (String(unit.availability || '') !== 'In Stock') return false;
        return /^https?:\/\//i.test(String(unit.video || '').trim());
    }

    function createUnitVideoLink(url) {
        const link = document.createElement('a');
        link.className = 'unit-video-link';
        link.href = String(url || '').trim();
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'View video of this unit (opens in new tab)');
        link.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        link.addEventListener('keydown', function (e) {
            e.stopPropagation();
        });

        const icon = document.createElement('span');
        icon.className = 'unit-video-link__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"></circle>' +
            '<polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"></polygon>' +
            '</svg>';
        link.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'unit-video-link__label';
        label.textContent = 'Video';
        link.appendChild(label);

        return link;
    }

    window.UNIT_ROW_EXTRAS = {
        createUnitCodeLabel: createUnitCodeLabel,
        unitShowsVideo: unitShowsVideo,
        createUnitVideoLink: createUnitVideoLink
    };
})();
