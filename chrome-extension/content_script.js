// content_script.js — Detect successful POS payments and play a sound.
// Also shows UI immediately on allowed pages.

(() => {

  const SUCCESS_CLASS = "o_payment_successful";

  let lastPlayed = 0;
  const MIN_INTERVAL = 1500;

  let selectedSound = "sound2.mp3";
  let ttsLang = "";
  let ttsEnabled = true;

  // Load settings early
  chrome.storage?.sync.get(
    { selectedSound, ttsLang, ttsEnabled: true },
    (items) => {
      selectedSound = items.selectedSound;
      ttsLang = items.ttsLang;
      ttsEnabled = items.ttsEnabled;
      try { updateMenuUI(); } catch (e) {}
    }
  );

  // Listen for settings changes (ttsEnabled / ttsLang / selectedSound)
  try {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.selectedSound) selectedSound = changes.selectedSound.newValue;
      if (changes.ttsLang) ttsLang = changes.ttsLang.newValue;
      if (changes.ttsEnabled) ttsEnabled = !!changes.ttsEnabled.newValue;
      try { updateMenuUI(); } catch (e) {}
    });
  } catch (e) { /* ignore */ }

  /** -------------------------------------------------------
   * UI: Always load immediately when script runs
   * ------------------------------------------------------*/
  function createUI() {
    if (document.getElementById("__ok_ui")) return;

    const wrap = document.createElement("div");
    wrap.id = "__ok_ui";
    Object.assign(wrap.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: 999999999,
      fontFamily: "system-ui"
    });

    const btn = document.createElement("button");
    btn.textContent = "🔔";
    Object.assign(btn.style, {
      width: "40px",
      height: "40px",
      borderRadius: "8px",
      border: "none",
      background: "#0b84ff",
      color: "white",
      fontSize: "20px",
      cursor: "pointer"
    });

    const menu = document.createElement("div");
    menu.id = "__ok_menu";
    Object.assign(menu.style, {
      display: "none",
      marginTop: "8px",
      padding: "10px",
      background: "white",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)"
    });

    const row1 = document.createElement("button");
    row1.id = '__ok_sound1';
    row1.type = 'button';
    row1.style.display = 'flex';
    row1.style.alignItems = 'center';
    row1.style.gap = '8px';
    const row1Check = document.createElement('span');
    row1Check.id = '__ok_sound1_check';
    row1Check.textContent = selectedSound === 'sound1.mp3' ? '✅' : '';
    const row1Label = document.createElement('span');
    row1Label.textContent = 'Sound 1';
    row1.appendChild(row1Check);
    row1.appendChild(row1Label);
    row1.style.marginBottom = '4px';
    row1.onclick = () => {
      selectedSound = 'sound1.mp3';
      try { chrome.storage.sync.set({ selectedSound }); } catch (e) {}
      try { updateMenuUI(); } catch (e) {}
    };

    const row2 = document.createElement('button');
    row2.id = '__ok_sound2';
    row2.type = 'button';
    row2.style.display = 'flex';
    row2.style.alignItems = 'center';
    row2.style.gap = '8px';
    const row2Check = document.createElement('span');
    row2Check.id = '__ok_sound2_check';
    row2Check.textContent = selectedSound === 'sound2.mp3' ? '✅' : '';
    const row2Label = document.createElement('span');
    row2Label.textContent = 'Sound 2';
    row2.appendChild(row2Check);
    row2.appendChild(row2Label);
    row2.onclick = () => {
      selectedSound = 'sound2.mp3';
      try { chrome.storage.sync.set({ selectedSound }); } catch (e) {}
      try { updateMenuUI(); } catch (e) {}
    };

    menu.appendChild(row1);
    menu.appendChild(row2);

    // TTS toggle row
    const ttsRow = document.createElement('div');
    ttsRow.style.display = 'flex';
    ttsRow.style.alignItems = 'center';
    ttsRow.style.justifyContent = 'space-between';
    ttsRow.style.paddingTop = '8px';
    const ttsLabel = document.createElement('div');
    ttsLabel.textContent = 'Enable TTS';
    ttsLabel.style.fontSize = '14px';
    const ttsInput = document.createElement('input');
    ttsInput.type = 'checkbox';
    ttsInput.id = '__ok_tts_input';
    ttsInput.checked = !!ttsEnabled;
    ttsInput.addEventListener('change', (ev) => {
      ttsEnabled = !!ttsInput.checked;
      try { chrome.storage.sync.set({ ttsEnabled }); } catch (e) {}
    });
    ttsRow.appendChild(ttsLabel);
    ttsRow.appendChild(ttsInput);
    menu.appendChild(ttsRow);

    btn.onclick = (ev) => {
      ev.stopPropagation();
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    };

    document.addEventListener("click", () => {
      menu.style.display = "none";
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    document.body.appendChild(wrap);
  }

  // Update visual state of the menu (checkmarks and TTS toggle)
  function updateMenuUI() {
    try {
      const c1 = document.getElementById('__ok_sound1_check');
      const c2 = document.getElementById('__ok_sound2_check');
      if (c1) c1.textContent = selectedSound === 'sound1.mp3' ? '✅' : '';
      if (c2) c2.textContent = selectedSound === 'sound2.mp3' ? '✅' : '';
      const ttsInput = document.getElementById('__ok_tts_input');
      if (ttsInput) ttsInput.checked = !!ttsEnabled;
    } catch (e) { /* ignore */ }
  }

  /** -------------------------------------------------------
   * Payment sound
   * ------------------------------------------------------*/
  function playSound() {
    const now = Date.now();
    if (now - lastPlayed < MIN_INTERVAL) return;
    lastPlayed = now;

    const src = chrome.runtime.getURL(selectedSound);
    const audio = new Audio(src);
    audio.volume = 1.0;
    audio.play().catch(() => {});
  }

  /** -------------------------------------------------------
   * Success detection
   * ------------------------------------------------------*/
  function isSuccessNode(n) {
    if (!n) return false;
    if (n.classList?.contains(SUCCESS_CLASS)) return true;
    if (n.querySelector?.("." + SUCCESS_CLASS)) return true;
    return false;
  }

  function scanInitial() {
    if (document.querySelector("." + SUCCESS_CLASS)) {
      playSound();
      try { speakPaymentAmount(); } catch (e) {}
    }
  }

  /** -------------------------------------------------------
   * MutationObserver
   * ------------------------------------------------------*/
  const observer = new MutationObserver((mut) => {
    for (const m of mut) {
      for (const node of m.addedNodes) {
        if (isSuccessNode(node)) {
          playSound();
          try { speakPaymentAmount(); } catch (e) {}
          return;
        }
        // If a paymentlines container (with total) was added, speak the amount
        try {
          if (node.querySelector && node.querySelector('.paymentlines-container .total, section.paymentlines-container .total, .payment-amount, .total')) {
            try { speakPaymentAmount(); } catch (e) {}
          }
        } catch (e) {}
      }
      if (m.type === "attributes" && isSuccessNode(m.target)) {
        playSound();
        try { speakPaymentAmount(); } catch (e) {}
        return;
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "id"]
  });

  /** -------------------------------------------------------
   * Start immediately when DOM exists
   * ------------------------------------------------------*/
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      createUI();
      try { updateMenuUI(); } catch (e) {}
      // attach product click TTS handlers
      try { observeProductClicks(); } catch (e) {}
      setTimeout(scanInitial, 80);
    });
  } else {
    createUI();
    try { updateMenuUI(); } catch (e) {}
    try { observeProductClicks(); } catch (e) {}
    try { observeAmounts(); } catch (e) {}
    setTimeout(scanInitial, 80);
  }

  /** -------------------------------------------------------
   * TTS: Speak the payment amount
   * ------------------------------------------------------*/
  function speakPaymentAmount() {
    if (!ttsEnabled) return;
    try {
      const el = document.querySelector('.paymentlines-container .total, section.paymentlines-container .total, .payment-amount, .total');
      if (!el) return;
      const text = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
      if (!text) return;
      try {
        if (window.__odooKachingTts && typeof window.__odooKachingTts.speakAmountFromText === 'function') {
          window.__odooKachingTts.speakAmountFromText(text, ttsLang || '');
          return;
        }
      } catch (e) { /* ignore */ }
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        const u = new SpeechSynthesisUtterance(text);
        if (ttsLang) u.lang = ttsLang;
        synth.cancel();
        synth.speak(u);
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
  }

  /** -------------------------------------------------------
   * Product click TTS: attach to product elements
   * ------------------------------------------------------*/
  function attachProductClickTts(article) {
    try {
      if (!article || article.dataset?.okTtsAttached) return;
      let label = '';
      const labelled = article.getAttribute && article.getAttribute('aria-labelledby');
      if (labelled) {
        const el = document.getElementById(labelled);
        if (el) label = el.textContent && el.textContent.trim();
      }
      if (!label) {
        const pn = article.querySelector && article.querySelector('.product-name');
        if (pn) label = pn.textContent && pn.textContent.trim();
      }
      if (!label) label = (article.textContent || '').trim().split('\n')[0] || '';
      if (!label) return;
      article.dataset.okTtsAttached = '1';
      article.addEventListener('click', (ev) => {
        try {
          if (!ttsEnabled) return;
          if (ev.target && ev.target.closest && ev.target.closest('button, a, input, .__ok_amount_tts')) return;
          if (window.__odooKachingTts && typeof window.__odooKachingTts.speak === 'function') {
            window.__odooKachingTts.speak(label, { lang: ttsLang || '' });
            return;
          }
          const synth = window.speechSynthesis;
          if (!synth) return;
          const u = new SpeechSynthesisUtterance(label);
          if (ttsLang) u.lang = ttsLang;
          synth.cancel();
          synth.speak(u);
        } catch (e) {}
      });
    } catch (e) { /* ignore */ }
  }

  function observeProductClicks() {
    try {
      const attachAll = () => {
        const articles = document.querySelectorAll('article[data-product-id]');
        for (const a of articles) attachProductClickTts(a);
      };
      attachAll();
      const obs = new MutationObserver(() => attachAll());
      obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }
  }

  /** -------------------------------------------------------
   * Amount TTS button and observer
   * ------------------------------------------------------*/
  function attachAmountTtsButton(amountEl) {
    try {
      if (!amountEl || amountEl.dataset?.okAmountAttached) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = '__ok_amount_tts';
      btn.title = 'Play amount';
      btn.textContent = '🔈';
      Object.assign(btn.style, { marginLeft: '8px', padding: '4px 8px', fontSize: '14px', verticalAlign: 'middle', cursor: 'pointer', borderRadius: '6px', border: 'none', background: 'rgba(0,0,0,0.05)' });
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try { speakPaymentAmount(); } catch (e) {}
      });
      // avoid duplicates
      amountEl.dataset.okAmountAttached = '1';
      try {
        if (amountEl.parentNode && amountEl.parentNode.nodeType === 1 && amountEl.parentNode.style && getComputedStyle(amountEl.parentNode).display.includes('flex')) {
          amountEl.parentNode.insertBefore(btn, amountEl.nextSibling);
        } else {
          amountEl.appendChild(btn);
        }
      } catch (e) {
        try { amountEl.appendChild(btn); } catch (ex) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  function observeAmounts() {
    try {
      const attachAll = () => {
        const els = document.querySelectorAll('.paymentlines-container .total, section.paymentlines-container .total, .payment-amount, .total');
        for (const el of els) attachAmountTtsButton(el);
      };
      attachAll();
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            for (const n of m.addedNodes) {
              try {
                if (n.nodeType === 1) {
                  const found = n.querySelectorAll && n.querySelectorAll('.paymentlines-container .total, section.paymentlines-container .total, .payment-amount, .total');
                  if (found && found.length) for (const f of found) attachAmountTtsButton(f);
                  if (n.matches && n.matches('.paymentlines-container .total, section.paymentlines-container .total, .payment-amount, .total')) attachAmountTtsButton(n);
                }
              } catch (e) {}
            }
          } else if (m.type === 'attributes') {
            try {
              const t = m.target;
              if (t && t.matches && t.matches('.paymentlines-container .total, section.paymentlines-container .total, .payment-amount, .total')) attachAmountTtsButton(t);
            } catch (e) {}
          }
        }
      });
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true });
    } catch (e) { /* ignore */ }
  }
})();
