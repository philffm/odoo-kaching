// options.js — minimal save/load of Odoo URL for Odoo Kaching
(function () {
  const form = document.getElementById('optionsForm');
  const status = document.getElementById('status');
  const odooInput = document.getElementById('odooUrl');
  const ttsSelect = document.getElementById('ttsLang');
  const grantBtn = document.getElementById('grantAccess');

  // Defensive: if the options page DOM isn't present (script executed in the wrong context), abort.
  if (!form) {
    console.warn('options.js: options form not found — aborting script.');
    return;
  }

  function loadOptions() {
    chrome.storage.sync.get({ odooUrl: '', ttsLang: '' }, (items) => {
      if (odooInput) odooInput.value = items.odooUrl || '';
      if (ttsSelect) ttsSelect.value = items.ttsLang || '';
      updateGrantButton(items.odooUrl || '');
    });
  }

  function patternFromUrl(urlString) {
    try {
      const u = new URL(urlString);
      // request permission for the origin only
      return u.origin + '/*';
    } catch (e) { return null; }
  }

  function updateGrantButton(odooUrl) {
    if (!grantBtn) return;
    if (!odooUrl) { grantBtn.style.display = 'none'; return; }
    // check if permission already granted
    const pattern = patternFromUrl(odooUrl);
    if (!pattern) { grantBtn.style.display = 'none'; return; }
    // show the origin pattern on hover for debugging/manual add
    try { grantBtn.title = 'Request access for ' + pattern; } catch (e) {}
    if (!chrome.permissions || !chrome.permissions.contains) {
      // if permissions API not available, show button to attempt anyway
      grantBtn.style.display = 'inline-block';
      return;
    }
    chrome.permissions.contains({ origins: [pattern] }, (contains) => {
      grantBtn.style.display = contains ? 'none' : 'inline-block';
    });
  }

  function saveOptions(e) {
    e.preventDefault();
    const odooUrl = (odooInput && odooInput.value) ? odooInput.value.trim() : '';

    // simple validation: accept empty or valid absolute URL
    if (odooUrl) {
      try {
        new URL(odooUrl);
      } catch (err) {
        status.textContent = 'Invalid Odoo URL';
        status.style.color = '#b00020';
        return;
      }
    }

    chrome.storage.sync.set({ odooUrl: odooUrl, ttsLang: (ttsSelect && ttsSelect.value) ? ttsSelect.value : '' }, () => {
      status.style.color = '#333';
      status.textContent = 'Saved.';
      setTimeout(() => { status.textContent = ''; }, 1500);
      updateGrantButton(odooUrl);
    });
  }

  // Request host permission for the configured Odoo URL
  function requestHostPermission() {
    const odooUrl = (odooInput && odooInput.value) ? odooInput.value.trim() : '';
    const pattern = patternFromUrl(odooUrl);
    if (!pattern) {
      status.style.color = '#b00020';
      status.textContent = 'Invalid URL for permission request';
      return;
    }
    if (!chrome.permissions || !chrome.permissions.request) {
      status.style.color = '#b00020';
      status.textContent = 'Permissions API not available';
      return;
    }
    console.log('Odoo Kaching: requesting host permission for', pattern);
    // show the pattern in the UI while requesting so the user knows what's being asked
    try { status.style.color = '#333'; status.textContent = 'Requesting access for ' + pattern; } catch (e) {}
    try {
      chrome.permissions.request({ origins: [pattern] }, (granted) => {
        if (granted) {
          status.style.color = '#333';
          status.textContent = 'Site access granted.';
          grantBtn.style.display = 'none';
          // Notify background that permission was granted so it can register the content script
          try {
            if (chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'hostPermissionGranted', odooUrl: odooUrl, pattern: pattern }, () => {});
            }
          } catch (e) { console.warn('Odoo Kaching: notify background failed', e); }
        } else {
          status.style.color = '#b00020';
          status.textContent = 'Site access denied.';
          // Provide debug hint and log lastError
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('Odoo Kaching: permissions.request lastError:', chrome.runtime.lastError);
          }
          console.warn('Odoo Kaching: permission request denied for', pattern);
        }
        setTimeout(() => { status.textContent = ''; }, 2000);
      });
    } catch (e) {
      console.error('Odoo Kaching: exception while requesting permissions', e);
      status.style.color = '#b00020';
      status.textContent = 'Permission request failed — check console.';
      setTimeout(() => { status.textContent = ''; }, 3000);
    }
  }

  form.addEventListener('submit', saveOptions);
  if (grantBtn) grantBtn.addEventListener('click', requestHostPermission);
  loadOptions();
})();
