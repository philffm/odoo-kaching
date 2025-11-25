// background.js — open options page on first install to request Odoo URL
chrome.runtime.onInstalled.addListener((details) => {
  try {
    if (details && details.reason === 'install') {
      // Check if odooUrl is already set (should be empty on fresh installs)
      chrome.storage.sync.get(['odooUrl'], (items) => {
        const url = items && items.odooUrl;
        if (!url) {
          // Open the options page so the user can enter the Odoo instance URL
          if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
          } else {
            // Fallback: open options.html directly
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
          }
        }
      });
    }
  } catch (e) {
    console.error('background onInstalled handler failed', e);
  }
});
