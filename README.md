# Facebook Auto Unmute Reels

A Tampermonkey userscript that automatically unmutes Facebook Reels and videos as they play.

## Features

- 🔊 **Auto-unmutes** Reels by clicking Facebook's unmute button and directly setting `video.muted = false`
- 🔄 **One-time reset** — rewinds each video to the start only once using a `Set`, so mid-video playback is never interrupted
- 🧹 **Automatic memory cleanup** — stale video IDs are pruned from the tracking Set when videos leave the DOM
- 🎯 **Reliable visibility check** — uses `getBoundingClientRect()` instead of `offsetParent` to correctly handle `position: fixed` elements
- ⚡ **Dual trigger** — polls every 1.2 seconds and re-runs 500ms after any page click
- 🚫 **Excludes Instagram** — explicitly skipped via `@exclude` so it doesn't conflict with the Instagram script

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Open Tampermonkey → Dashboard → click the **+** tab to create a new script
3. Paste in the contents of [`facebook-auto-unmute.user.js`](facebook-auto-unmute.user.js)
4. Save and navigate to [Facebook](https://www.facebook.com) — it works automatically

## Requirements

- A Chromium-based or Firefox browser
- [Tampermonkey](https://www.tampermonkey.net/) v4.0 or later

## How It Works

The script triggers on a 1.2-second interval and also on every page click (with a 500ms delay). Each trigger:

1. **Clicks any visible unmute button** — queries `div[aria-label="Unmute"][role="button"]` and the broader `[aria-label="Unmute"]`, only acting on visible elements via `getBoundingClientRect()`
2. **Stamps each video with a stable ID** — uses `dataset.unmuterId` (set to `video.src` or a unique fallback) so IDs don't shift when the DOM changes
3. **Unmutes and resets once per video** — sets `muted = false` every poll, but only rewinds `currentTime` to `0` the first time a video is seen
4. **Prunes the tracking Set** — after each poll, removes IDs for videos no longer present in the DOM to prevent memory leaks

## Changelog

**v2.0**
- Added `resetDone` Set so videos are only rewound once — fixes repeated interruptions mid-playback
- Replaced `offsetParent` visibility check with `getBoundingClientRect()` for accuracy with `position: fixed` elements
- Added stable `dataset.unmuterId` stamping — fixes unreliable index-based video IDs
- Added DOM pruning to clean up stale IDs from the tracking Set
- Slowed interval from 0.8s to 1.2s — click listener covers fast response cases

**v1.1**
- Added `document` click listener as a secondary trigger
- Tightened unmute button selector with `role="button"` while keeping broad fallback

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
