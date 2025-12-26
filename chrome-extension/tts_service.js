// tts_service.js
// Exposes a simple TTS service on window.__odooKachingTts
(function () {
  const state = { ttsLang: '', voicesReady: false };
  const DEBUG_TTS = false;
  function logTts(...args) { if (DEBUG_TTS) console.log("[Odoo Kaching TTS service]", ...args); }

  function safeGetVoices() {
    try {
      const v = window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
      if (DEBUG_TTS) logTts("voices length =", v.length);
      return v;
    } catch (e) { return []; }
  }

  // mark when voices are loaded
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        state.voicesReady = true;
        logTts("voiceschanged:", safeGetVoices().length);
      };
    }
  } catch (e) {}

  function pickVoice(lang) {
    try {
      const voices = safeGetVoices();
      if (!voices.length) return null;
      if (lang) {
        const prefix = String(lang).toLowerCase();
        const match = voices.find(v => (v.lang || '').toLowerCase().startsWith(prefix));
        if (match) return match;
      }
      return voices[0];
    } catch (e) { return null; }
  }

  function speak(text, opts = {}) {
    try {
      if (!text) return;
      const synth = window.speechSynthesis;
      if (!synth) {
        logTts("speak: no speechSynthesis");
        return;
      }
      const lang = (opts.lang || state.ttsLang || '').replace('_', '-') || '';
      const utter = new SpeechSynthesisUtterance(String(text));
      if (lang) utter.lang = lang;
      const v = pickVoice(lang);
      if (v) utter.voice = v;
      logTts("speak:", text, "lang =", lang, "voice =", v && v.name);
      try { synth.cancel(); } catch (e) {}
      synth.speak(utter);
    } catch (e) { console.error('Odoo Kaching TTS: speak failed', e); }
  }

  // Parse amount text and speak polite localized phrase. Reuses logic from content script.
  function speakAmountFromText(text, preferredLang) {
    try {
      if (!text) return;
      // normalize nbsp
      text = String(text).replace(/\u00A0/g, ' ').trim();

      const currencySymbols = { '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', 'CHF': 'CHF' };
      let detectedSymbol = Object.keys(currencySymbols).find(s => text.includes(s));
      const isoMatch = text.match(/\b(EUR|USD|GBP|JPY|CHF|CAD|AUD)\b/i);
      let currencyCode = isoMatch ? isoMatch[0].toUpperCase() : (detectedSymbol ? currencySymbols[detectedSymbol] : null);

      const numMatch = text.match(/-?\d{1,3}(?:[\.,\s]\d{3})*(?:[\.,]\d+)?|-?\d+[\.,]\d+|-?\d+/);
      let amount = null;
      if (numMatch) {
        let s = numMatch[0].replace(/\s+/g, '');
        const hasDot = s.indexOf('.') !== -1;
        const hasComma = s.indexOf(',') !== -1;
        if (hasDot && hasComma) {
          if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
          else s = s.replace(/,/g, '');
        } else if (hasComma && !hasDot) {
          s = s.replace(/,/g, '.');
        } else {
          s = s.replace(/,/g, '');
        }
        const n = parseFloat(s);
        if (!Number.isNaN(n)) amount = n;
      }

      // compute major/minor
      let major = null;
      let minor = 0;
      if (typeof amount === 'number') {
        const abs = Math.abs(amount);
        major = Math.floor(abs);
        minor = Math.round((abs - major) * 100);
        if (minor === 100) { major += 1; minor = 0; }
      }

      const currencyNames = {
        EUR: { de: 'Euro', en: 'euro', fr: 'euro', es: 'euro', it: 'euro', nl: 'euro' },
        USD: { de: 'US-Dollar', en: 'dollar', fr: 'dollar', es: 'dólar', it: 'dollaro', nl: 'dollar' },
        GBP: { de: 'Pfund', en: 'pound', fr: 'livre', es: 'libra', it: 'sterlina', nl: 'pond' },
        JPY: { de: 'Yen', en: 'yen', fr: 'yen', es: 'yen', it: 'yen', nl: 'yen' },
        CHF: { de: 'Franken', en: 'franc', fr: 'franc', it: 'franco', nl: 'frank' }
      };

      const minorNames = {
        EUR: { de: 'Cent', en: 'cent', fr: 'centime', es: 'céntimo', it: 'centesimo', nl: 'cent' },
        USD: { de: 'Cent', en: 'cent', fr: 'cent', es: 'centavo', it: 'cent', nl: 'cent' },
        GBP: { de: 'Pence', en: 'pence', fr: 'pence', es: 'pence', it: 'pence', nl: 'pence' },
        JPY: { de: '', en: '', fr: '', es: '', it: '', nl: '' },
        CHF: { de: 'Rappen', en: 'rappen', fr: 'rappen', it: 'rappen', nl: 'rappen' }
      };

      const polite = { de: 'bitte', fr: "s'il vous plaît", es: 'por favor', it: 'per favore', nl: 'alstublieft', en: 'please' };

      const locale = (preferredLang || state.ttsLang || '').toLowerCase().replace('_', '-') || undefined;
      const langPrefix = (locale || '').split('-')[0] || 'en';

      const majorName = (currencyCode && currencyNames[currencyCode]) ? (currencyNames[currencyCode][langPrefix] || currencyNames[currencyCode]['en']) : (currencyCode || '');
      const minorName = (currencyCode && minorNames[currencyCode]) ? (minorNames[currencyCode][langPrefix] || minorNames[currencyCode]['en']) : '';

      let phrase = '';
      if (typeof major === 'number') {
        const majorPart = major.toString();
        const minorPart = (minor && minor > 0) ? minor.toString().padStart(2, '0') : '';

        switch (langPrefix) {
          case 'de':
            if (major === 0 && minorPart) {
              phrase = `${parseInt(minorPart,10)} ${minorName || 'Cent'}`;
            } else {
              phrase = majorName ? `${majorPart} ${majorName}` : `${majorPart}`;
              if (minorPart) phrase += ` und ${parseInt(minorPart,10)} ${minorName || 'Cent'}`;
            }
            phrase += ` ${polite.de}`;
            break;
          case 'fr':
            if (major === 0 && minorPart) {
              phrase = `${parseInt(minorPart,10)} ${minorName || 'centime'}`;
            } else {
              phrase = majorName ? `${majorPart} ${majorName}` : `${majorPart}`;
              if (minorPart) phrase += ` et ${parseInt(minorPart,10)} ${minorName || 'centime'}`;
            }
            phrase += ` ${polite.fr}`;
            break;
          case 'es':
            if (major === 0 && minorPart) {
              phrase = `${parseInt(minorPart,10)} ${minorName || 'céntimos'}`;
            } else {
              phrase = majorName ? `${majorPart} ${majorName}` : `${majorPart}`;
              if (minorPart) phrase += ` con ${parseInt(minorPart,10)} ${minorName || 'céntimos'}`;
            }
            phrase += ` ${polite.es}`;
            break;
          case 'it':
            if (major === 0 && minorPart) {
              phrase = `${parseInt(minorPart,10)} ${minorName || 'centesimi'}`;
            } else {
              phrase = majorName ? `${majorPart} ${majorName}` : `${majorPart}`;
              if (minorPart) phrase += ` e ${parseInt(minorPart,10)} ${minorName || 'centesimi'}`;
            }
            phrase += ` ${polite.it}`;
            break;
          case 'nl':
            if (major === 0 && minorPart) {
              phrase = `${parseInt(minorPart,10)} ${minorName || 'cent'}`;
            } else {
              phrase = majorName ? `${majorPart} ${majorName}` : `${majorPart}`;
              if (minorPart) phrase += ` en ${parseInt(minorPart,10)} ${minorName || 'cent'}`;
            }
            phrase += ` ${polite.nl}`;
            break;
          default:
            if (major === 0 && minorPart) {
              phrase = `${parseInt(minorPart,10)} ${minorName || 'cents'}`;
            } else {
              phrase = majorName ? `${majorPart} ${majorName}` : `${majorPart}`;
              if (minorPart) phrase += ` and ${parseInt(minorPart,10)} ${minorName || 'cents'}`;
            }
            phrase += `, ${polite.en}`;
        }
      } else {
        phrase = text;
      }

      speak(phrase, { lang: locale });
    } catch (e) { console.error('Odoo Kaching TTS: speakAmountFromText failed', e); }
  }

  // monitor storage for ttsLang updates
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        if (changes.ttsLang) state.ttsLang = changes.ttsLang.newValue || '';
      });
      // initial read
      chrome.storage.sync.get(['ttsLang'], (items) => { state.ttsLang = (items && items.ttsLang) ? items.ttsLang : ''; });
    }
  } catch (e) { /* ignore */ }

  // expose API
  try {
    window.__odooKachingTts = {
      speak: speak,
      speakAmountFromText: speakAmountFromText,
      setLang: (l) => { state.ttsLang = l; }
    };
  } catch (e) { console.error('Odoo Kaching TTS: failed to expose API', e); }
  
})();