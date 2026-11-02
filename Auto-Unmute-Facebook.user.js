// ==UserScript==
// @name         Facebook Auto Unmute Reels
// @namespace    http://tampermonkey.net/
// @version      3.0
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
    const APPLY_DELAY_MS = 120;          // coalesce bursts of observer callbacks
    const RESCAN_MS = 5000;              // safety net: find new videos, re-check mute
    const ACTIVE_VIDEO_MIN_RATIO = 0.6;  // on-screen fraction needed to silence the others
    const UNMUTE_LABELS = ['Unmute'];    // add your UI language's label(s) here

    // The points at which the browser reports that a video's on-screen
    // fraction changed. The decision boundary is included, so we get a
    // callback exactly when a video crosses it.
    const RATIO_THRESHOLDS = [0, 0.25, 0.5, ACTIVE_VIDEO_MIN_RATIO, 0.75, 1];

    const log = (...args) => { if (DEBUG) console.log('[auto-unmute]', ...args); };

    log('v3.0 started');

    // One selector built from every localized label we know about.
    const UNMUTE_SELECTOR = UNMUTE_LABELS.map(label => `[aria-label="${label}"]`).join(', ');

    // element -> the source we last rewound it on. WeakMap keys are collected
    // with the element, so there is nothing to prune.
    const lastResetSrc = new WeakMap();

    // element -> last on-screen fraction the browser reported for it. This
    // replaces measuring getBoundingClientRect() ourselves: the observer hands
    // us the number for free, and only when it actually changes.
    const ratios = new WeakMap();

    // Videos already handed to the observer, so we never observe one twice.
    const observed = new WeakSet();

    let haveRatios = false;

    const io = new IntersectionObserver(entries => {
        for (const entry of entries) {
            ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
            haveRatios = true;
        }
        scheduleApply(APPLY_DELAY_MS);
    }, { threshold: RATIO_THRESHOLDS });

    function observeVideos() {
        for (const video of document.querySelectorAll('video')) {
            if (!observed.has(video)) {
                observed.add(video);
                io.observe(video);
            }
        }
    }

    function isVisible(el) {
        if (typeof el.checkVisibility === 'function') {
            return el.checkVisibility();
        }
        // Fallback for older browsers: a zero-size box means not visible.
        // Only ever runs on a handful of buttons, never on the video list.
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function applyMuteState() {
        // Nothing measured yet: touching mute state now would act on a guess.
        if (!haveRatios) return;

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
            const ratio = ratios.get(video) || 0;
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

    let pendingTimer = null;
    function scheduleApply(delay) {
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(applyMuteState, delay);
    }

    // New <video> elements need observing, and re-running picks up anything
    // the observer hasn't reported yet.
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
            if (!hasRelevantMutation(records)) return;
            observeVideos();
            scheduleApply(APPLY_DELAY_MS);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // Safety net for state that changes without the observer noticing: a video
    // re-muting itself, or a player swapped in without a DOM insertion we saw.
    // Cheap, because it reads no layout.
    setInterval(() => {
        observeVideos();
        applyMuteState();
    }, RESCAN_MS);

    // Re-run shortly after clicks to catch player state changes.
    document.addEventListener('click', () => scheduleApply(APPLY_DELAY_MS));

    // Start observing immediately; the observer's first callback drives the
    // first unmute, and the delayed run covers anything it missed.
    observeVideos();
    scheduleApply(1000);

    log('ready');
})();
