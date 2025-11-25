// background.js — Dynamically registers content_script.js for the configured Odoo URL

function patternFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    return u.origin + "/*";
  } catch (e) {
    return null;
  }
}

async function unregisterScript() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ["odooKaching"] });
    chrome.action?.setBadgeText({ text: "" });
  } catch (e) {}
}

async function registerForUrl(odooUrl) {
  await unregisterScript();
  if (!odooUrl) return;

  const pattern = patternFromUrl(odooUrl);
  if (!pattern) return;

  const hasPermission = await new Promise((resolve) => {
    chrome.permissions?.contains({ origins: [pattern] }, (ok) =>
      resolve(!!ok)
    );
  });

  if (!hasPermission) {
    console.warn("Odoo Kaching: Missing host permission:", pattern);
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: "odooKaching",
      matches: [pattern],
      js: ["tts_service.js", "content_script.js"],
      runAt: "document_idle"
    }
  ]);

  chrome.action?.setBadgeText({ text: "ON" });
  chrome.action?.setBadgeBackgroundColor?.({ color: "#22c55e" });

  console.log("Odoo Kaching: content script registered for", pattern);
}

// On first install → open options page
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.get(["odooUrl"], (items) => {
      if (!items.odooUrl) {
        chrome.runtime.openOptionsPage();
      }
    });
  }
});

// On startup → re-register existing URL
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get(["odooUrl"], (items) => {
    if (items.odooUrl) registerForUrl(items.odooUrl);
  });
});

// React to options page granting permissions
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "hostPermissionGranted" && msg.odooUrl) {
    registerForUrl(msg.odooUrl);
  }
});

// Initial registration attempt
chrome.storage.sync.get(["odooUrl"], (items) => {
  if (items.odooUrl) registerForUrl(items.odooUrl);
});

// Re-register when options change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.odooUrl) {
    registerForUrl(changes.odooUrl.newValue || "");
  }
});
