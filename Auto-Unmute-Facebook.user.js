// ==UserScript==
// @name         Facebook Auto Unmute Reels
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Automatically unmutes the Facebook Reels and videos you are watching
// @author       poorloading
// @match        https://*.facebook.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/poorloading/facebook-auto-unmute/main/Auto-Unmute-Facebook.user.js
// @downloadURL  https://raw.githubusercontent.com/poorloading/facebook-auto-unmute/main/Auto-Unmute-Facebook.user.js
// ==/UserScript==
(function () {
    'use strict';

    const DEBUG = false;                 // console logging on/off
    const POLL_MS = 1200;                // safety-net cadence (matches Instagram script)
    const CLICK_DELAY_MS = 500;          // let player state settle after a click
    const MUTATION_DELAY_MS = 200;       // coalesce bursts of DOM churn into one run
    const ACTIVE_VIDEO_MIN_RATIO = 0.6;  // on-screen fraction needed to silence the others
    const UNMUTE_LABELS = ['Unmute'];    // add your UI language's label(s) here

    const log = (...args) => { if (DEBUG) console.log('[auto-unmute]', ...args); };

    log('v2.2 started');

    // One selector built from every localized label we know about.
    const UNMUTE_SELECTOR = UNMUTE_LABELS.map(label => `[aria-label="${label}"]`).join(', ');

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

    // Fraction (0-1) of the element that is currently within the viewport.
    function visibleRatio(el) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return 0;

        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;

        const visibleWidth = Math.min(rect.right, vw) - Math.max(rect.left, 0);
        const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
        if (visibleWidth <= 0 || visibleHeight <= 0) return 0;

        const totalArea = rect.width * rect.height;
        return totalArea > 0 ? (visibleWidth * visibleHeight) / totalArea : 0;
    }

    function unmute() {
        // Click any visible unmute button.
        for (const btn of document.querySelectorAll(UNMUTE_SELECTOR)) {
            if (isVisible(btn)) {
                btn.click();
                log('unmute button clicked');
            }
        }

        const videos = Array.from(document.querySelectorAll('video'));
        if (!videos.length) return;

        // Pick the single most on-screen video: that is the one the user is
        // actually watching. Without this every preloaded feed preview plays
        // its audio at once, on top of the reel that was opened.
        let active = null;
        let best = 0;
        for (const video of videos) {
            const ratio = visibleRatio(video);
            if (ratio > best) {
                best = ratio;
                active = video;
            }
        }

        for (const video of videos) {
            if (video === active) {
                if (video.muted) {
                    video.muted = false;
                    log('active video unmuted');
                }

                // New element, or a reused element whose source changed (e.g.
                // Facebook swapped in the next Reel) -> rewind once.
                // currentSrc is the media actually playing; src is empty when
                // the element loads through <source> children.
                const src = video.currentSrc || video.src;
                if (lastResetSrc.get(video) !== src) {
                    try {
                        video.currentTime = 0;
                    } catch (err) {
                        log('rewind failed', err);
                    }
                    lastResetSrc.set(video, src);
                    log('active video reset to start');
                }
            } else if (best >= ACTIVE_VIDEO_MIN_RATIO && !video.muted) {
                // Something is clearly on screen, so silence everything behind it.
                video.muted = true;
                log('inactive video muted');
            }
            // Deliberately nothing when no video clears the threshold: leave
            // the other players alone rather than muting the whole page.
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
        const selector = `video, ${UNMUTE_SELECTOR}`;
        for (const { addedNodes } of records) {
            for (const node of addedNodes) {
                if (node.nodeType !== 1) continue; // elements only
                if (node.matches(selector)) return true;
                if (node.querySelector(selector)) return true;
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
