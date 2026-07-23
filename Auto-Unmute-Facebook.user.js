// ==UserScript==
// @name         Facebook Auto Unmute Reels
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically unmutes Facebook Reels and videos
// @author       Grok
// @match        https://www.facebook.com/*
// @match        https://*.facebook.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('🚀 Facebook Auto Unmute v1.0 started');

    function unmute() {
        const buttons = document.querySelectorAll('div[aria-label="Unmute"][role="button"], [aria-label="Unmute"]');
        
        buttons.forEach(btn => {
            if (btn.offsetParent !== null) {
                btn.click();
                console.log('✅ Unmute button clicked');
            }
        });

        document.querySelectorAll('video').forEach(video => {
            if (video.muted) {
                video.muted = false;
                video.currentTime = 0;
                console.log('✅ Video unmuted and reset');
            }
        });
    }

    setInterval(unmute, 800);
    document.addEventListener('click', () => setTimeout(unmute, 500));

    console.log('✅ Facebook script ready');
})();