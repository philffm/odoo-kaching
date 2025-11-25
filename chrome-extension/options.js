// options.js — minimal save/load of Odoo URL for Odoo Kaching
(function () {
  const form = document.getElementById('optionsForm');
  const status = document.getElementById('status');
  const odooInput = document.getElementById('odooUrl');

  // Defensive: if the options page DOM isn't present (script executed in the wrong context), abort.
  if (!form) {
    console.warn('options.js: options form not found — aborting script.');
    return;
  }

  function loadOptions() {
    chrome.storage.sync.get({ odooUrl: '' }, (items) => {
      if (odooInput) odooInput.value = items.odooUrl || '';
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

    chrome.storage.sync.set({ odooUrl: odooUrl }, () => {
      status.style.color = '#333';
      status.textContent = 'Saved.';
      setTimeout(() => { status.textContent = ''; }, 1500);
    });
  }

  form.addEventListener('submit', saveOptions);
  loadOptions();
})();
