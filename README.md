# Facebook Auto Unmute Reels

![version](https://img.shields.io/badge/version-2.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Tampermonkey%20Userscript-orange)
![browsers](https://img.shields.io/badge/browsers-Chromium%20%7C%20Firefox-lightgrey)

A lightweight Tampermonkey userscript that automatically unmutes Facebook Reels
and videos the moment they appear — no more tapping the speaker icon on every
clip. It clicks Facebook's own unmute button *and* sets `video.muted = false`
directly, so playback starts with sound regardless of how the player loaded.

---

## Why?

Facebook ships Reels muted by default to satisfy browser autoplay policies, and
re-mutes the next reel when you scroll. If you'd rather just hear everything,
this script does the unmuting for you, on every reel, automatically.

## Features

- 🔊 **Auto-unmutes** by clicking Facebook's unmute button *and* setting
  `video.muted = false` directly for belt-and-suspenders reliability.
- ⚡ **Reacts in ~200ms** to newly-injected videos via a `MutationObserver`, so
  freshly-scrolled reels are handled near-instantly — no waiting on a poll.
- 🔄 **Rewinds once per source** — each video is sent back to its start the first
  time it's seen, but never re-interrupted mid-playback.
- 🧹 **Zero-leak tracking** — state lives in a `WeakMap` keyed on each `<video>`,
  so it's garbage-collected automatically. No DOM mutation, no manual cleanup.
- 🎯 **Accurate visibility checks** — uses `Element.checkVisibility()` (with a
  `getBoundingClientRect()` fallback) so hidden buttons are never misclicked.
- 🚫 **Stays out of Instagram** — explicitly `@exclude`d so it won't clash with
  a separate Instagram userscript.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
   (v4.0 or later).
2. Open Tampermonkey → **Dashboard** → click the **+** tab to create a new script.
3. Delete the starter template, then paste in the contents of
   [`Auto-Unmute-Facebook.user.js`](Auto-Unmute-Facebook.user.js).
4. Save (`Ctrl`/`Cmd` + `S`) and open [facebook.com](https://www.facebook.com).
   That's it — Reels will now play with sound.

> **Tip:** You can also point Tampermonkey at the raw file via **Utilities →
> Import from URL** if you host it yourself.

## Usage

Once installed it runs automatically — there's nothing to click. Open the
browser console and you'll see lines prefixed `[auto-unmute]` confirming each
action. To silence them, set `DEBUG = false` at the top of the script.

The script activates on any `facebook.com` page and watches for `<video>`
elements and unmute buttons appearing anywhere in the document.

## Configuration

All tunables live at the top of the file. Adjust to taste, then save:

```js
const DEBUG = true;             // console logging on/off
const POLL_MS = 1200;           // safety-net poll interval (ms)
const CLICK_DELAY_MS = 500;     // delay after a click before re-running (ms)
const MUTATION_DELAY_MS = 200;  // debounce window for DOM changes (ms)
```

| Constant | Lower it to… | Raise it to… |
|---|---|---|
| `MUTATION_DELAY_MS` | react faster to new reels | coalesce more churn into one run |
| `POLL_MS` | catch silent re-mutes sooner | reduce background CPU |
| `CLICK_DELAY_MS` | respond to clicks faster | give the player more time to settle |

**Don't want the auto-rewind?** Delete (or comment out) the `video.currentTime =
0;` block inside `unmute()`. Unmuting will still work; videos just won't snap
back to the start.

## How it works

Three independent triggers all funnel through a single debounced `unmute()` run:

1. **`MutationObserver`** — watches `document.body` for newly-added nodes. When a
   new `<video>` or unmute button appears, `unmute` is scheduled ~200ms later
   (debounced so bursts of DOM changes fire it once).
2. **Click listener** — any page click schedules `unmute` after 500ms, catching
   player state changes that follow a user interaction.
3. **Polling fallback** — every 1.2s, to catch state changes that touch no DOM
   (e.g. a video silently re-muting itself).

Each `unmute()` run:

1. Finds every `[aria-label="Unmute"]` button and `.click()`s the visible ones.
2. Sets `video.muted = false` on every `<video>`.
3. Rewinds a video to `currentTime = 0` only when its `src` has changed since
   the last rewind (new element, or a reused element playing the next reel).
4. Records that `src` in the `WeakMap`, so it's cleaned up automatically when
   the element leaves the DOM.

## Troubleshooting

**A reel stays muted.** Browsers' autoplay policies can block a script-set
`muted = false` when there's no recent user gesture. The button click usually
still works; if not, click anywhere on the page once and the click-triggered run
will retry. Check the console for `[auto-unmute]` lines to confirm it's firing.

**Nothing happens at all.** Confirm the script is enabled in the Tampermonkey
dashboard and that you're on a `facebook.com` URL (it's `@exclude`d on
Instagram). `@run-at` is `document-idle`, so give the page a moment after load.

**The console is noisy.** Set `DEBUG = false` at the top of the script.

**It's unmuting the wrong thing.** The script targets every visible `<video>`
and `[aria-label="Unmute"]` button, so it can't distinguish between, say, a feed
preview and a fullscreen reel. That's by design — it unmutes all of them.

## Browser support

Tested on current Chromium-based browsers and Firefox. `Element.checkVisibility()`
is used where available (Chrome 105+, Firefox 113+, Safari 16.4+); older
browsers fall back to a `getBoundingClientRect()` box-size check.

## Privacy

The script runs entirely in your browser. It reads and modifies Facebook's page
elements locally and makes **no network requests** of its own.

## Changelog

**v2.1** — reliability & responsiveness overhaul
- Replaced `dataset.unmuterId` + `resetDone` Set + manual pruning with a single
  `WeakMap` keyed on each `<video>` (auto-GC, no DOM mutation).
- Reset now keys on the video's *current* `src`, so a reused element rewinds
  again when Facebook swaps in the next reel.
- Added a `MutationObserver` on `document.body` for ~200ms reaction to injected
  videos/buttons.
- Unified click/observer/poll triggers behind a shared debounce.
- Switched visibility check to `Element.checkVisibility()` (with fallback).
- Dropped the redundant `div[aria-label="Unmute"][role="button"]` selector.
- Added a `DEBUG` flag and `[auto-unmute]` log prefix.

**v2.0** — stability pass
- Added a `resetDone` Set so videos rewind only once (fixes mid-playback jumps).
- Replaced `offsetParent` with `getBoundingClientRect()` for fixed elements.
- Added stable `dataset.unmuterId` stamping (vs. fragile index-based IDs).
- Added DOM pruning of stale IDs; slowed the poll from 0.8s to 1.2s.

**v1.1**
- Added a `document` click listener as a secondary trigger.
- Tightened the unmute selector with `role="button"` (kept a broad fallback).

## Contributing

Pull requests are welcome. For major changes, please open an issue first to
discuss what you'd like to change.

## License

[MIT](LICENSE)
