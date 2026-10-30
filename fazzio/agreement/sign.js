(function () {
  'use strict';

  var A = window.FazzioAgreement;
  var $ = function (s) { return document.querySelector(s); };
  var code = new URLSearchParams(location.search).get('code') || '';
  var data = null;
  var pad = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function when(iso) {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' }) + ' (Philippine time)';
  }

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function showError(sel, msg) {
    $(sel).textContent = msg;
    $(sel).hidden = !msg;
  }

  // ---------- loading ----------

  function askForCode(msg) {
    $('#code-box').hidden = false;
    showError('#code-error', msg || '');
  }

  $('#code-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = $('#code-input').value.trim();
    var m = /[?&]code=([^&\s]+)/.exec(raw);
    code = m ? decodeURIComponent(m[1]) : raw;
    history.replaceState(null, '', '?code=' + encodeURIComponent(code));
    load();
  });

  function load() {
    fetch('/api/fazzio/agreement/view?code=' + encodeURIComponent(code), { cache: 'no-store' })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Couldn’t load the agreement.');
          return body;
        });
      })
      .then(function (body) {
        data = body;
        $('#code-box').hidden = true;
        render();
      })
      .catch(function (err) { askForCode(err.message); });
  }

  // ---------- rendering ----------

  function buyerFromForm() {
    var b = {};
    A.BUYER_FIELDS.forEach(function (f) { b[f.key] = $('#b-' + f.key).value; });
    return b;
  }

  function sigBlock(role, sig) {
    return '<div class="sig-block"><span class="sig-role">' + role + '</span>' +
      (sig
        ? '<img src="' + esc(sig.image) + '" alt="' + role + ' signature"><strong>' + esc(sig.typedName) + '</strong>' +
          '<small>Signed electronically on ' + esc(when(sig.signedAt)) + '</small>'
        : '<div class="sig-empty">Not signed yet</div>') +
      '</div>';
  }

  function render() {
    var d = data.details || {};
    var signed = data.buyerSignature;
    $('#doc-box').hidden = false;
    $('#state-box').hidden = false;

    if (signed) {
      $('#buyer-box').hidden = true;
      $('#sign-box').hidden = true;
      sha256(A.toText(d, data.buyer)).then(function (hash) {
        $('#doc').innerHTML = hash === signed.textHash ? A.html(d, data.buyer) : A.textToHtml(data.signedText);
      });
      $('#sig-blocks').hidden = false;
      $('#sig-blocks').innerHTML = sigBlock('Buyer', signed) + sigBlock('Seller', data.sellerSignature);
      $('#audit').hidden = false;
      $('#audit').innerHTML = '<p><strong>Signature record</strong></p>' +
        '<p>Document fingerprint (SHA-256): <code>' + esc(signed.textHash) + '</code></p>' +
        '<p>Buyer signed on ' + esc(when(signed.signedAt)) + ' from IP ' + esc(signed.ip || 'unknown') + '.</p>' +
        (data.sellerSignature
          ? '<p>Seller countersigned on ' + esc(when(data.sellerSignature.signedAt)) + ' from IP ' + esc(data.sellerSignature.ip || 'unknown') + '.</p>'
          : '');
      $('#doc-actions').hidden = false;
      $('#state-text').innerHTML = '<strong>Signed by ' + esc(signed.typedName) + '.</strong> ' +
        (data.sellerSignature ? 'The seller has countersigned, so the agreement is complete. Save a copy with the button at the bottom.'
          : 'Waiting for the seller’s countersignature.');
      return;
    }

    if (!data.open) {
      $('#state-text').textContent = 'The agreement isn’t open for signing yet. You can read it below; the seller will let you know when it’s ready.';
      $('#doc').innerHTML = A.html(d, {});
      return;
    }

    $('#state-text').textContent = 'Fill in your details, read the agreement, then sign at the bottom.';
    $('#buyer-box').hidden = false;
    $('#sign-box').hidden = false;
    if (!$('#buyer-fields').children.length) {
      $('#buyer-fields').innerHTML = A.BUYER_FIELDS.map(function (f) {
        return '<label class="field-label">' + esc(f.label) +
          '<input type="text" id="b-' + f.key + '" placeholder="' + esc(f.placeholder || '') + '" autocomplete="off"></label>';
      }).join('');
      A.BUYER_FIELDS.forEach(function (f) {
        $('#b-' + f.key).addEventListener('input', function () { $('#doc').innerHTML = A.html(d, buyerFromForm()); });
      });
    }
    $('#doc').innerHTML = A.html(d, buyerFromForm());
    if (!pad) {
      pad = window.FazzioSignaturePad($('#sig-pad'));
      pad.onChange(function () { $('#pad-hint').hidden = !pad.isEmpty(); });
    } else {
      pad.resize();
    }
  }

  // ---------- signing ----------

  $('#pad-clear').addEventListener('click', function () { if (pad) pad.clear(); });

  $('#btn-sign').addEventListener('click', function () {
    var b = buyerFromForm();
    var missing = A.missingBuyer(b);
    var typed = $('#typed-name').value.replace(/\s+/g, ' ').trim();
    showError('#sign-error', '');
    if (missing.length) return showError('#sign-error', 'Please fill in: ' + missing.join(', ') + '.');
    if (typed.toLowerCase() !== b.name.replace(/\s+/g, ' ').trim().toLowerCase()) return showError('#sign-error', 'Type your full name exactly as you entered it in your details.');
    if (!pad || pad.isEmpty()) return showError('#sign-error', 'Please sign in the box.');
    if (!$('#consent').checked) return showError('#sign-error', 'Please tick the box to confirm you agree.');
    var btn = $('#btn-sign');
    btn.disabled = true;
    btn.textContent = 'Signing…';
    sha256(A.toText(data.details, cleanBuyer(b)))
      .then(function (hash) {
        return fetch('/api/fazzio/agreement/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code, buyer: b, typedName: typed, image: pad.toDataURL(), consent: true, textHash: hash }),
        });
      })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Signing failed. Please try again.');
        });
      })
      .then(function () { window.scrollTo(0, 0); load(); })
      .catch(function (err) {
        showError('#sign-error', err.message);
        btn.disabled = false;
        btn.textContent = 'Sign the agreement';
      });
  });

  /** Mirrors the server's clean-up so both sides fingerprint the same text. */
  function cleanBuyer(b) {
    var out = {};
    A.BUYER_FIELDS.forEach(function (f) { out[f.key] = String(b[f.key] || '').replace(/\s+/g, ' ').trim().slice(0, 300); });
    return out;
  }

  $('#btn-print').addEventListener('click', function () { window.print(); });

  if (code) load();
  else askForCode('');
})();
