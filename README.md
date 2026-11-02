# Facebook Auto Unmute Reels

![version](https://img.shields.io/badge/version-3.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Tampermonkey%20Userscript-orange)
![browsers](https://img.shields.io/badge/browsers-Chromium%20%7C%20Firefox-lightgrey)

A lightweight Tampermonkey userscript that automatically unmutes the Facebook
Reel or video you're actually watching — no more tapping the speaker icon on
every clip. It clicks Facebook's own unmute button *and* sets `video.muted =
false` directly, so playback starts with sound regardless of how the player
loaded, while everything scrolled off-screen stays silent.

---

## Why?

Facebook ships Reels muted by default to satisfy browser autoplay policies, and
re-mutes the next reel when you scroll. If you'd rather just hear everything,
this script does the unmuting for you, on every reel, automatically.

## Features

- 🔊 **Auto-unmutes** by clicking Facebook's unmute button *and* setting
  `video.muted = false` directly for belt-and-suspenders reliability.
- ⚡ **Reacts on scroll, not on a timer** — an `IntersectionObserver` reports
  when a video's on-screen fraction changes, so scrolling to a new reel is
  handled immediately with no polling.
- 🎬 **One video at a time** — only the most on-screen video is unmuted; every
  other `<video>` (feed previews, preloaded reels) is force-muted, so audio
  never overlaps. If no video clears `ACTIVE_VIDEO_MIN_RATIO`, the other
  players are left alone rather than muting the whole page.
- 🪶 **No layout thrash on the video list** — the observer supplies each
  video's on-screen fraction, so the script never calls
  `getBoundingClientRect()` on a player. On a long feed that removes the
  repeated forced layout the old polling design caused.
- 🔄 **Rewinds once per source** — each video is sent back to its start the first
  time it's seen, but never re-interrupted mid-playback. Tracking keys on
  `currentSrc`, so a reused element that switches to the next reel rewinds again.
- 🧹 **Zero-leak tracking** — state lives in a `WeakMap` keyed on each `<video>`,
  so it's garbage-collected automatically. No DOM mutation, no manual cleanup.
- 🎯 **Accurate visibility checks** — uses `Element.checkVisibility()` (with a
  `getBoundingClientRect()` fallback) so hidden buttons are never misclicked.
- 🌍 **Localized labels** — add your UI language's unmute label to
  `UNMUTE_LABELS` if `aria-label="Unmute"` doesn't exist in your locale.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
   (v4.0 or later).
2. Open Tampermonkey → **Dashboard** → click the **+** tab to create a new script.
3. Delete the starter template, then paste in the contents of
   [`Auto-Unmute-Facebook.user.js`](Auto-Unmute-Facebook.user.js).
4. Save (`Ctrl`/`Cmd` + `S`) and open [facebook.com](https://www.facebook.com).
   That's it — Reels will now play with sound.

Because the script declares `@updateURL` / `@downloadURL`, your manager checks
this repository for updates on its own, so fixes reach you without reinstalling.

> **Tip:** You can also install straight from the raw file — open
> [`Auto-Unmute-Facebook.user.js`](https://raw.githubusercontent.com/poorloading/facebook-auto-unmute/main/Auto-Unmute-Facebook.user.js)
> and Tampermonkey will offer to install it.

## Usage

Once installed it runs automatically — there's nothing to click. Console
logging is off by default; set `DEBUG = true` at the top of the script to see
lines prefixed `[auto-unmute]` for each action it takes.

The script activates on any `facebook.com` page and watches for `<video>`
elements and unmute buttons appearing anywhere in the document.

## Configuration

All tunables live at the top of the file. Adjust to taste, then save:

```js
const DEBUG = false;                 // console logging on/off
const APPLY_DELAY_MS = 120;          // coalesce bursts of observer callbacks (ms)
const RESCAN_MS = 5000;              // safety-net rescan interval (ms)
const ACTIVE_VIDEO_MIN_RATIO = 0.6;  // on-screen fraction before others are muted
const UNMUTE_LABELS = ['Unmute'];    // add your UI language's label(s) here
```

| Constant | Lower it to… | Raise it to… |
|---|---|---|
| `APPLY_DELAY_MS` | react faster to a scroll | coalesce more churn into one run |
| `RESCAN_MS` | catch silent re-mutes sooner | reduce background CPU |
| `ACTIVE_VIDEO_MIN_RATIO` | silence other players more eagerly | leave more videos unmuted in a feed |

If Reels stay muted on a small window, lower `ACTIVE_VIDEO_MIN_RATIO`. If audio
from an off-screen video still creeps in, raise it.

**Don't want the auto-rewind?** Delete (or comment out) the `video.currentTime =
0;` block inside `applyMuteState()`. Unmuting will still work; videos just won't
snap back to the start.

## How it works

One `IntersectionObserver` watches every `<video>`, plus two cheap triggers
that all funnel through a single debounced `applyMuteState()` run:

1. **`IntersectionObserver`** — the browser reports a video's on-screen
   fraction whenever it crosses one of `RATIO_THRESHOLDS`, with no measurement
   on our side. That is what drives unmuting while you scroll.
2. **`MutationObserver`** — watches `document.body` for new `<video>` and
   unmute-button nodes. New players get handed to the observer, then a run is
   scheduled.
3. **Safety-net rescan** — every `RESCAN_MS`, to catch state changes that touch
   no DOM (e.g. a video silently re-muting itself), and to pick up any player
   the mutation observer missed.

Each `applyMuteState()` run:

1. Finds every unmute button matching `UNMUTE_LABELS` and `.click()`s the
   visible ones.
2. Picks the `<video>` with the highest on-screen fraction the observer has
   reported, and treats that as the active video.
3. Unmutes the active video — the only one allowed to play audio.
4. Force-mutes the other videos, but only when the active video is at least
   `ACTIVE_VIDEO_MIN_RATIO` on screen. Otherwise the other players are left
   untouched rather than muting the whole page.
5. Rewinds the active video to `currentTime = 0` when its `currentSrc` has
   changed since the last rewind (new element, or a reused element playing the
   next reel), and records that source in the `WeakMap`, so it's cleaned up
   automatically when the element leaves the DOM.

## Troubleshooting

**A reel stays muted.** Browsers' autoplay policies can block a script-set
`muted = false` when there's no recent user gesture. The button click usually
still works; if not, click anywhere on the page once and the click-triggered run
will retry. Check the console for `[auto-unmute]` lines to confirm it's firing.

**Nothing happens at all.** Confirm the script is enabled in the Tampermonkey
dashboard and that you're on a `facebook.com` URL (it only matches
`*.facebook.com`). `@run-at` is `document-idle`, so give the page a moment
after load.

**The console is noisy.** It shouldn't be: `DEBUG` is `false` by default. Set it
to `true` only while diagnosing something.

**It's unmuting the wrong thing.** It shouldn't anymore: only the most
on-screen video is unmuted and the rest are muted. If a background player still
audibly bleeds through, raise `ACTIVE_VIDEO_MIN_RATIO`.

**The unmute button never gets clicked.** `aria-label="Unmute"` is the English
UI label, and Facebook localizes it (e.g. `Activer le son` in French). Add your
locale's label to `UNMUTE_LABELS`. The direct `video.muted = false` path still
works without it, so reels should still get sound.

## Browser support

Tested on current Chromium-based browsers and Firefox. `Element.checkVisibility()`
is used where available (Chrome 105+, Firefox 113+, Safari 16.4+); older
browsers fall back to a `getBoundingClientRect()` box-size check.

## Privacy

The script runs entirely in your browser. It reads and modifies Facebook's page
elements locally and makes **no network requests** of its own.

## Changelog

**v3.0** — observer-driven, no polling
- Replaced the 1.2s poll with an `IntersectionObserver`. The browser reports
  each video's on-screen fraction when it crosses a threshold, so the script no
  longer calls `getBoundingClientRect()` on any player — the repeated forced
  layout on a long feed is gone.
- The poll survives only as a `RESCAN_MS` (5s) safety net for state changes
  that touch no DOM, such as a video re-muting itself.
- New videos are handed to the observer from the `MutationObserver`, and
  `RATIO_THRESHOLDS` includes `ACTIVE_VIDEO_MIN_RATIO` so a callback fires
  exactly at the decision boundary.
- Nothing is unmuted or muted until the observer has reported a ratio, so the
  script no longer acts on a guess at startup.
- `POLL_MS`, `CLICK_DELAY_MS` and `MUTATION_DELAY_MS` are gone, replaced by
  `APPLY_DELAY_MS` and `RESCAN_MS`.

**v2.2** — no more overlapping audio
- Only the most on-screen video is unmuted; every other `<video>` is force-muted,
  so feed previews and preloaded reels can no longer play over the clip you
  opened. Ported from the Instagram script's v2.1.0 fix.
- Rewind tracking now keys on `currentSrc` rather than `src`, so elements that
  load media through `<source>` children are still handled.
- Wrapped the `currentTime = 0` seek in `try/catch`, so a player in an odd state
  can't throw out of the poll loop.
- Added `@updateURL` / `@downloadURL`, so installed copies now auto-update.
- Added `LICENSE` (MIT), which this README already claimed.
- Added `UNMUTE_LABELS`, so non-English UI labels can be supported.
- `DEBUG` now defaults to `false`.
- Dropped the dead `https://*.instagram.com/*` `@exclude` (it could never match a
  `facebook.com` `@match`) and the redundant `www.facebook.com` `@match`.

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

## Testing

The core logic runs headlessly against a stubbed DOM, so no browser is needed:

```
node test/unmute.test.js
```

It covers active-video selection, the force-mute guard, and rewind-once-per-source
behaviour. No dependencies — just Node.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to
discuss what you'd like to change.

## License

[MIT](LICENSE)
