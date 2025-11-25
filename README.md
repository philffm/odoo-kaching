# Odoo Kaching — Payment Sound Chrome Extension

Plays a short cashier / "ka-ching" sound when an element with id or class `o_payment_successful` appears on a page (intended for Odoo payment success flows).

Installation (Load unpacked extension in Chrome):

1. Open `chrome://extensions/` in Chrome.
2. Enable "Developer mode" (toggle top-right).
3. Click "Load unpacked" and select the project folder `odoo-kaching` (the directory that contains `manifest.json`).

Testing:

- Navigate to your Odoo test page that triggers payment success.
- When the page inserts an element with id `o_payment_successful` or class `o_payment_successful` the extension will play the sound.

If you want to test from the console on any page, run:

```js
window.__odooKaching && window.__odooKaching.play();
```

Notes and customization:
- The content script currently matches all URLs (`<all_urls>`). To restrict it to a particular Odoo host or path, edit `manifest.json` `content_scripts.matches` to the desired pattern (for example `https://your-odoo-host/*`).
- The audio is synthesized with the Web Audio API to avoid shipping a binary audio file. If you prefer a real sample, place an audio file in the extension and modify `content_script.js` to load and play it.

Packaged sounds
- The extension will try `cashier-quotka-chingquot-sound-effect-129698.mp3` in the extension root and play it when a payment success element appears. If that file is missing or playback is blocked it will try a short list of fallback filenames and finally play a synthesized sound.
Credits
- Sound Effect by freesound_community from Pixabay — https://pixabay.com/users/freesound_community-46691455
- Sound Effect by u_byub5wd934 from Pixabay — https://pixabay.com/users/u_byub5wd934

If you want a different filename or to put sounds in a subfolder, tell me and I'll update `content_script.js` accordingly.

Feel free to ask me to add an options page to configure URL matching or to embed an audio file instead of synthesized audio.
