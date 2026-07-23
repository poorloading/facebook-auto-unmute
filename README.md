# Facebook Auto Unmute Reels

A Tampermonkey userscript that automatically unmutes Facebook Reels and videos as they play.

## Features

- 🔊 **Auto-unmutes** Reels by clicking Facebook's unmute button and directly setting `video.muted = false`
- 🔄 **Resets playback** to the start each time a muted video is detected
- ⚡ **Dual trigger** — polls every 0.8 seconds *and* re-runs 500ms after any click on the page
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

The script triggers on a 0.8-second interval and also on every page click (with a 500ms delay to let Facebook's player react). Each trigger:

1. **Clicks any visible unmute button** — queries `div[aria-label="Unmute"][role="button"]` and the broader `[aria-label="Unmute"]` to cover Facebook's varying DOM structure, only clicking elements where `offsetParent !== null`
2. **Directly unmutes video elements** — iterates all `<video>` tags, and for any that are muted sets `muted = false` and resets `currentTime` to `0`

> **Note:** Unlike the Instagram script, the Facebook version resets `currentTime` on *every* unmute detection rather than tracking which videos have already been reset. This is intentional — Facebook's Reels player replaces video `src` frequently enough that per-video tracking isn't needed.

## Changelog

**v1.1**
- Added `document` click listener as a secondary trigger for faster response when navigating between Reels
- Tightened unmute button selector to prefer `div[role="button"]` while keeping the broad fallback

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
