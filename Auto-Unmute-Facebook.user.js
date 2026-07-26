// ==UserScript==
// @name         Facebook Auto Unmute Reels
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Automatically unmutes Facebook Reels and videos
// @author       Grok
// @match        https://www.facebook.com/*
// @match        https://*.facebook.com/*
// @exclude      https://*.instagram.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
    'use strict';

    const DEBUG = true;
    const POLL_MS = 1200;            // safety-net cadence (matches Instagram script)
    const CLICK_DELAY_MS = 500;      // let player state settle after a click
    const MUTATION_DELAY_MS = 200;   // coalesce bursts of DOM churn into one run

    const log = (...args) => { if (DEBUG) console.log('[auto-unmute]', ...args); };

    log('v2.1 started');

    // WeakMap keyed on each <video>, storing the src we last rewound to.
    // Keys are garbage-collected automatically when the element leaves the
    // DOM, so there is nothing to prune — no dataset stamping, no Set cleanup.
    const lastResetSrc = new WeakMap();

    function isVisible(el) {
        if (typeof el.checkVisibility === 'function') {
            return el.checkVisibility();
        }
        // Fallback for older browsers: a zero-size box means not visible.
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function unmute() {
        // Click any visible unmute button (selector already covers div+role).
        for (const btn of document.querySelectorAll('[aria-label="Unmute"]')) {
            if (isVisible(btn)) {
                btn.click();
                log('unmute button clicked');
            }
        }

        // Unmute every video and rewind it to the start once per src.
        for (const video of document.querySelectorAll('video')) {
            if (video.muted) {
                video.muted = false;
                log('video unmuted');
            }

            // New element, or a reused element whose source changed (e.g.
            // Facebook swapped in the next Reel) -> rewind once.
            if (lastResetSrc.get(video) !== video.src) {
                video.currentTime = 0;
                lastResetSrc.set(video, video.src);
                log('video reset to start');
            }
        }
    }

    // Shared debounce so clicks, mutations, etc. coalesce into one run.
    let pendingTimer = null;
    function scheduleUnmute(delay) {
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(unmute, delay);
    }

    // React the moment Facebook injects a new <video> or unmute button,
    // instead of waiting up to POLL_MS for the next poll.
    function hasRelevantMutation(records) {
        for (const { addedNodes } of records) {
            for (const node of addedNodes) {
                if (node.nodeType !== 1) continue; // elements only
                if (node.matches('video, [aria-label="Unmute"]')) return true;
                if (node.querySelector('video, [aria-label="Unmute"]')) return true;
            }
        }
        return false;
    }

    if (document.body) {
        new MutationObserver(records => {
            if (hasRelevantMutation(records)) scheduleUnmute(MUTATION_DELAY_MS);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // Safety-net poll for state changes that don't touch the DOM
    // (e.g. a video re-muting itself).
    setInterval(unmute, POLL_MS);

    // Re-run shortly after clicks to catch player state changes.
    document.addEventListener('click', () => scheduleUnmute(CLICK_DELAY_MS));

    // Kick things off after the page has had a moment to load.
    scheduleUnmute(1000);

    log('ready');
})();
