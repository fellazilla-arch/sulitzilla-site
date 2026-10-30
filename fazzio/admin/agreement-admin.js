(function () {
  'use strict';

  var A = window.FazzioAgreement;
  var $ = function (s) { return document.querySelector(s); };
  var key = '';
  var ag = null;
  var ledger = null;
  var pad = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function when(iso) {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  }

  function api(method, path, body) {
    return fetch('/api/fazzio/agreement' + path, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || 'Request failed (' + res.status + ').');
        return data;
      });
    });
  }

  function showError(sel, msg) {
    $(sel).textContent = msg || '';
    $(sel).hidden = !msg;
  }

  // ---------- fields ----------

  function fieldHtml(f) {
    var id = 'ag-f-' + f.key;
    var input;
    if (f.type === 'date') input = '<input type="date" id="' + id + '">';
    else if (f.type === 'dueday') {
      input = '<select id="' + id + '"><option value="0">Same day of the month as handover</option>' +
        Array.from({ length: 28 }, function (_, i) { return '<option value="' + (i + 1) + '">Day ' + (i + 1) + ' of each month</option>'; }).join('') +
        '</select>';
    } else if (f.type === 'orcr') {
      input = '<select id="' + id + '"><option value="">Choose…</option>' +
        '<option value="copy">He gets a photocopy + your signed authorization to use it</option>' +
        '<option value="original">He keeps the original OR/CR with the motorcycle</option></select>';
    } else input = '<input type="text" id="' + id + '" placeholder="' + esc(f.placeholder || '') + '">';
    return '<label>' + esc(f.label) + input + '</label>';
  }

  $('#ag-fields').innerHTML = A.DETAIL_FIELDS.map(fieldHtml).join('');

  function readFields() {
    var d = {};
    A.DETAIL_FIELDS.forEach(function (f) { d[f.key] = $('#ag-f-' + f.key).value; });
    d.dueDay = Number(d.dueDay) || 0;
    return d;
  }

  function fillFields(d) {
    A.DETAIL_FIELDS.forEach(function (f) {
      var v = d[f.key];
      if ((v === undefined || v === '') && ledger) {
        if (f.key === 'handoverDate') v = ledger.handoverDate;
        if (f.key === 'dueDay') v = ledger.dueDay;
      }
      $('#ag-f-' + f.key).value = v === undefined || v === null ? (f.key === 'dueDay' ? '0' : '') : String(v);
    });
  }

  // ---------- render ----------

  function signingUrl() {
    return location.origin + '/fazzio/agreement/?code=' + encodeURIComponent(ag.code || '');
  }

  function render() {
    var signed = !!ag.buyerSignature;
    var countersigned = !!ag.sellerSignature;
    var missing = A.missingDetails(ag.details);

    $('#ag-link').value = ag.code ? signingUrl() : 'Save the details to create the link';
    $('#ag-view').href = ag.code ? signingUrl() : '#';
    $('#ag-edit').hidden = signed;
    $('#ag-reset-row').hidden = !signed;
    $('#ag-countersign').hidden = !signed || countersigned;
    $('#ag-open').textContent = ag.open ? 'Close signing' : 'Open for signing';

    var state;
    if (countersigned) state = 'Complete. He signed on ' + when(ag.buyerSignature.signedAt) + ' and you countersigned on ' + when(ag.sellerSignature.signedAt) + '. Open his signing page to see or download the signed copy.';
    else if (signed) state = 'Signed by ' + ag.buyerSignature.typedName + ' on ' + when(ag.buyerSignature.signedAt) + ' (IP ' + (ag.buyerSignature.ip || 'unknown') + '). Waiting for your countersignature.';
    else if (ag.open) state = 'Open for signing. Send him the link below.';
    else if (missing.length) state = 'Not open yet. Still needed: ' + missing.join(', ') + '.';
    else state = 'Details complete. Open it for signing when you’re ready (for example, after your advisor has reviewed the terms).';
    $('#ag-state').textContent = state;

    if (signed && !countersigned) {
      if (!pad) {
        pad = window.FazzioSignaturePad($('#ag-pad'));
        pad.onChange(function () { $('#ag-pad-hint').hidden = !pad.isEmpty(); });
      } else pad.resize();
      if (!$('#ag-seller-name').value) $('#ag-seller-name').value = ag.details.sellerName || '';
    }
  }

  function load() {
    return api('GET', '').then(function (data) {
      ag = data;
      fillFields(ag.details || {});
      $('#ag-admin').hidden = false;
      render();
    }).catch(function (err) { showError('#ag-error', err.message); $('#ag-admin').hidden = false; });
  }

  // ---------- actions ----------

  function save(extra) {
    showError('#ag-error', '');
    $('#ag-saved').textContent = 'Saving…';
    var body = { details: readFields() };
    if (extra) for (var k in extra) body[k] = extra[k];
    return api('PUT', '', body).then(function (data) {
      ag = data;
      $('#ag-saved').textContent = 'Saved';
      $('#ag-saved').className = 'save-state ok';
      render();
    }).catch(function (err) {
      $('#ag-saved').textContent = '';
      showError('#ag-error', err.message);
    });
  }

  $('#ag-save').addEventListener('click', function () { save(); });
  $('#ag-open').addEventListener('click', function () {
    if (!ag.open && !confirm('Open the agreement for signing? Once he signs, the terms and details are locked.')) return;
    save({ open: !ag.open });
  });

  $('#ag-copy').addEventListener('click', function () {
    if (!ag.code) return;
    navigator.clipboard.writeText(signingUrl()).then(function () {
      $('#ag-copy').textContent = 'Copied';
      setTimeout(function () { $('#ag-copy').textContent = 'Copy link'; }, 1500);
    });
  });

  $('#ag-newcode').addEventListener('click', function () {
    if (!confirm('Make a new link? The old link will stop working.')) return;
    api('POST', '/code').then(function (data) { ag = data; render(); }).catch(function (err) { showError('#ag-error', err.message); });
  });

  $('#ag-pad-clear').addEventListener('click', function () { if (pad) pad.clear(); });

  $('#ag-sign').addEventListener('click', function () {
    var name = $('#ag-seller-name').value.trim();
    showError('#ag-sign-error', '');
    if (!name) return showError('#ag-sign-error', 'Type your full name.');
    if (!pad || pad.isEmpty()) return showError('#ag-sign-error', 'Sign in the box.');
    if (!confirm('Countersign the agreement as ' + name + '?')) return;
    api('POST', '/countersign', { name: name, image: pad.toDataURL() })
      .then(function (data) { ag = data; render(); })
      .catch(function (err) { showError('#ag-sign-error', err.message); });
  });

  $('#ag-reset').addEventListener('click', function () {
    if (!confirm('Clear both signatures? He will have to sign again. A backup of the signed version is kept on the server.')) return;
    if (!confirm('Are you sure?')) return;
    api('POST', '/reset').then(function (data) { ag = data; pad = null; fillFields(ag.details || {}); render(); })
      .catch(function (err) { alert(err.message); });
  });

  document.addEventListener('fazzio:login', function (e) {
    key = e.detail.key;
    ledger = e.detail.ledger;
    load();
  });
  document.addEventListener('fazzio:logout', function () {
    key = '';
    $('#ag-admin').hidden = true;
  });
})();
