// content_script.js
// Watches the DOM for an element with id or class 'o_payment_successful'
// and plays a short cashier sound via Web Audio API when detected.

(function () {
  // Only initialize the main content script when allowed by configured Odoo URL.
  // Behavior: if no `odooUrl` is stored, run everywhere (default). If `odooUrl` is set,
  // only initialize when the current page matches the configured URL (origin+optional path).
  function startIfAllowed() {
    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['odooUrl'], (items) => {
          const odooUrl = (items && items.odooUrl) ? String(items.odooUrl).trim() : '';
          if (odooUrl) {
            try {
              const parsed = new URL(odooUrl);
              const base = parsed.origin + (parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/,'') : '');
              // allow any path on the origin if only origin provided
              if (base && !location.href.startsWith(base) && location.origin !== parsed.origin) {
                // Not a matching page — do not initialize
                return;
              }
            } catch (e) {
              // invalid stored URL — treat as unset and proceed
            }
          }
          // allowed: initialize main script
          init();
        });
        return;
      }
    } catch (e) {
      // fall through to init
    }
    // No storage available — initialize by default
    init();
  }

  // Main entrypoint (moved body of script here)
  function init() {
  const SELECTOR_ID = 'o_payment_successful';
  const SELECTOR_CLASS = 'o_payment_successful';
  let lastPlayed = 0;
  const MIN_INTERVAL_MS = 1500; // debounce between plays

  // Packaged filenames (renamed by user)
  const FILE_A = 'sound1.mp3';
  const FILE_B = 'sound2.mp3';
  let selectedSound = FILE_B;
  let audioEnabled = false; // set true after a user gesture

  function playCashSound() {
    const now = Date.now();
    if (now - lastPlayed < MIN_INTERVAL_MS) return;
    lastPlayed = now;

    // Try to play packaged audio files from extension root first.
    // If none available or playback blocked, fall back to synthesized audio.
    const candidateFiles = [
      FILE_A, FILE_B,
      'sound.mp3', 'sound.wav',
      'kaching.mp3', 'kaching.wav',
      'cash.mp3', 'cash.wav',
      'payment_success.mp3', 'payment_success.wav'
    ];

    function playPackagedAudioList(files) {
      return new Promise((resolve) => {
        let idx = 0;

        function tryNext() {
          if (idx >= files.length) return resolve(false);
          const filename = files[idx++];
          try {
            console.debug('Odoo Kaching: trying audio file', filename);
            const src = (chrome && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL(filename) : filename;
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.volume = 0.9;
            // try to load and play; some autoplay policies may block play()
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
              playPromise.then(() => {
                // played
                console.debug('Odoo Kaching: played', filename);
                resolve(true);
              }).catch(() => {
                console.debug('Odoo Kaching: play blocked for', filename);
                // couldn't play this file, try next
                tryNext();
              });
            } else {
              // older browsers may not return promise; assume it played
              resolve(true);
            }
          } catch (e) {
            tryNext();
          }
        }

        tryNext();
      });
    }

    function playSynthesizedAudio() {
      try {
        console.debug('Odoo Kaching: playing synthesized audio');
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);

        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.4));

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);

        const biquad = ctx.createBiquadFilter();
        biquad.type = 'highpass';
        biquad.frequency.value = 800;

        osc.connect(gain);
        gain.connect(ctx.destination);
        noise.connect(biquad);
        biquad.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        osc.start();
        noise.start();

        osc.stop(ctx.currentTime + 0.6);
        noise.stop(ctx.currentTime + 0.25);

        setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1000);
      } catch (err) {
        console.error('Odoo Kaching: synthesized audio failed', err);
      }
    }

  // Create a small enable button to obtain a user gesture if autoplay is blocked.
  function createEnableButton() {
    if (audioEnabled) return;
    if (document.getElementById('__odoo_kaching_enable_btn')) return;
    const btn = document.createElement('button');
    btn.id = '__odoo_kaching_enable_btn';
    btn.textContent = 'Enable sounds';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      zIndex: 2147483647,
      padding: '8px 10px',
      background: '#0b84ff',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      cursor: 'pointer',
      fontSize: '13px'
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audioEnabled = true;
      try { btn.remove(); } catch (err) {}
      // play a quick test to register user gesture
      try { window.__odooKaching && window.__odooKaching.play(); } catch (err) {}
    });
    document.body.appendChild(btn);
  }

  // Create a small bell UI to enable sound and choose between two bundled files.
  function createBellUI() {
    try {
      if (document.getElementById('__odoo_kaching_ui')) return;
      const container = document.createElement('div');
      container.id = '__odoo_kaching_ui';
      Object.assign(container.style, {
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        zIndex: 2147483647,
        fontFamily: 'Arial, system-ui, -apple-system',
        color: '#111'
      });

      const btn = document.createElement('button');
      btn.id = '__odoo_kaching_bell';
      btn.setAttribute('aria-label', 'Odoo Kaching: sound options');
      btn.innerHTML = '🔔';
      Object.assign(btn.style, {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        background: '#0b84ff',
        color: 'white',
        fontSize: '18px',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
      });

      const menu = document.createElement('div');
      menu.id = '__odoo_kaching_menu';
      Object.assign(menu.style, {
        display: 'none',
        marginTop: '8px',
        padding: '8px',
        background: 'white',
        color: '#111',
        borderRadius: '8px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        minWidth: '220px'
      });

      const enableRow = document.createElement('div');
      enableRow.style.marginBottom = '8px';
      const enableBtn = document.createElement('button');
      enableBtn.textContent = audioEnabled ? 'Sound enabled' : 'Enable sounds';
      Object.assign(enableBtn.style, { padding: '6px 8px', cursor: 'pointer' });
      enableBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audioEnabled = true;
        try { chrome.storage && chrome.storage.sync && chrome.storage.sync.set({ audioEnabled: true }); } catch (err) {}
        enableBtn.textContent = 'Sound enabled';
        // play a quick test to register gesture
        try { window.__odooKaching && window.__odooKaching.play(); } catch (err) {}
      });
      enableRow.appendChild(enableBtn);

      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '6px';

      function makeOption(label, filename) {
        const row = document.createElement('button');
        row.textContent = label;
        Object.assign(row.style, { textAlign: 'left', padding: '6px 8px', cursor: 'pointer', background: 'transparent', border: '1px solid #eee', borderRadius: '6px' });
        row.addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectedSound = filename;
          try { chrome.storage && chrome.storage.sync && chrome.storage.sync.set({ selectedSound: selectedSound }); } catch (err) {}
          audioEnabled = true;
          try { chrome.storage && chrome.storage.sync && chrome.storage.sync.set({ audioEnabled: true }); } catch (err) {}
          // Play a tiny preview/test
          playPackagedAudioList([selectedSound]).then((played) => {
            if (!played) playSynthesizedAudio();
          }).catch(() => playSynthesizedAudio());
        });
        return row;
      }

      const opt1 = makeOption('Sound 1 — sound1.mp3', FILE_A);
      const opt2 = makeOption('Sound 2 — sound2.mp3', FILE_B);
      list.appendChild(opt1);
      list.appendChild(opt2);

      menu.appendChild(enableRow);
      menu.appendChild(list);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
      });

      // hide menu on outside click
      document.addEventListener('click', (ev) => {
        if (!container.contains(ev.target)) menu.style.display = 'none';
      });

      container.appendChild(btn);
      container.appendChild(menu);
      document.body.appendChild(container);
    } catch (err) {
      console.error('Odoo Kaching: failed to create UI', err);
    }
  }

  // Load persisted settings (selected sound and enabled flag)
  function loadSettings() {
    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ selectedSound: selectedSound, audioEnabled: false }, (items) => {
          if (items) {
            selectedSound = items.selectedSound || selectedSound;
            audioEnabled = !!items.audioEnabled;
          }
        });
      }
    } catch (e) {}
  }

  try { if (document.readyState === 'complete' || document.readyState === 'interactive') { loadSettings(); createBellUI(); } else { window.addEventListener('DOMContentLoaded', () => { loadSettings(); createBellUI(); }); } } catch (e) {}

    // Single-file behavior: always try selectedSound first; if blocked/missing, try candidateFiles, then synth
    try {
      const tryPrimary = () => {
        if (!audioEnabled) {
          // quick attempt; if blocked, leave UI so user can enable
          playPackagedAudioList([selectedSound]).then((played) => {
            if (!played) {/* UI will let user enable */}
          }).catch(() => {});
        } else {
          playPackagedAudioList([selectedSound]).then((played) => {
            if (!played) {
              playPackagedAudioList(candidateFiles).then((played2) => { if (!played2) playSynthesizedAudio(); });
            }
          }).catch(() => playSynthesizedAudio());
        }
      };

      tryPrimary();
    } catch (err) {
      // fallback
      playPackagedAudioList(candidateFiles).then((played) => { if (!played) playSynthesizedAudio(); }).catch(() => playSynthesizedAudio());
    }
  }

  function checkNode(node) {
    if (!node) return false;
    // check id
    if (node.id === SELECTOR_ID) return true;
    // check classList
    if (node.classList && node.classList.contains(SELECTOR_CLASS)) return true;
    // also check descendants
    if (node.querySelector) {
      if (node.querySelector('#' + SELECTOR_ID)) return true;
      if (node.querySelector('.' + SELECTOR_CLASS)) return true;
    }
    return false;
  }

  function scanAndPlay(root = document) {
    if (checkNode(root)) {
      playCashSound();
      return true;
    }
    return false;
  }

  // If element exists already on load, play once
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    scanAndPlay(document);
  } else {
    window.addEventListener('DOMContentLoaded', () => scanAndPlay(document));
  }

  // Observe DOM mutations for inserted nodes
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (scanAndPlay(n)) return; // stop early if found
        }
      } else if (m.type === 'attributes') {
        const target = m.target;
        if (checkNode(target)) {
          playCashSound();
          return;
        }
      }
    }
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['id', 'class']
  });

  // expose a small API for testing from console
  window.__odooKaching = {
    play: playCashSound
  };

  } // end init

  // Begin conditional startup
  startIfAllowed();

})();
