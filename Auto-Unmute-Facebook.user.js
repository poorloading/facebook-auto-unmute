// ==UserScript==
// @name         Facebook Auto Unmute Reels
// @namespace    http://tampermonkey.net/
// @version      2.0
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
    console.log('🚀 Facebook Auto Unmute v2.0 started');

    const resetDone = new Set();

    function isVisible(el) {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function stampId(video, index) {
        if (!video.dataset.unmuterId) {
            video.dataset.unmuterId = video.src || `video-${index}-${Date.now()}`;
        }
        return video.dataset.unmuterId;
    }

    function unmute() {
        // Click visible unmute buttons
        document.querySelectorAll('div[aria-label="Unmute"][role="button"], [aria-label="Unmute"]')
            .forEach(btn => {
                if (isVisible(btn)) {
                    btn.click();
                    console.log('✅ Unmute button clicked');
                }
            });

        // Unmute videos and reset only once per video
        document.querySelectorAll('video').forEach((video, index) => {
            const id = stampId(video, index);

            if (video.muted) {
                video.muted = false;
                console.log('✅ Video unmuted');
            }

            if (!resetDone.has(id)) {
                video.currentTime = 0;
                resetDone.add(id);
                console.log('✅ Video reset to start (once)');
            }
        });

        // Prune stale IDs for videos no longer in the DOM
        const liveIds = new Set(
            Array.from(document.querySelectorAll('video'))
                .map(v => v.dataset.unmuterId)
                .filter(Boolean)
        );
        resetDone.forEach(id => {
            if (!liveIds.has(id)) resetDone.delete(id);
        });
    }

    // Poll at 1.2s (same as Instagram — click listener handles fast response)
    setInterval(unmute, 1200);

    // Re-run shortly after clicks to catch player state changes
    document.addEventListener('click', () => setTimeout(unmute, 500));

    // Initial run
    setTimeout(unmute, 1000);

    console.log('✅ Facebook script ready');
})();
