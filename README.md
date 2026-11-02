# Facebook Auto Unmute Reels

[![license](https://img.shields.io/github/license/poorloading/facebook-auto-unmute)](LICENSE)
[![last commit](https://img.shields.io/github/last-commit/poorloading/facebook-auto-unmute)](https://github.com/poorloading/facebook-auto-unmute/commits/main)
[![Tampermonkey](https://img.shields.io/badge/userscript-Tampermonkey-orange)](Auto-Unmute-Facebook.user.js)

A Tampermonkey userscript that unmutes Facebook Reels and videos automatically.
Facebook ships Reels muted to satisfy browser autoplay policies, and re-mutes the
next one when you scroll — this script turns the sound back on for the video
you're actually watching, so you stop tapping the speaker icon on every clip.

Everything scrolled off-screen stays silent, so a feed full of previews can't
talk over the reel you opened.

> **Also available for Instagram:** [instagram-auto-unmute](https://github.com/poorloading/instagram-auto-unmute)

---

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Requirements](#requirements)
- [Usage](#usage)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Privacy](#privacy)
- [Testing](#testing)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🔊 **Sound on, automatically.** Clicks Facebook's own unmute button *and* sets
  `video.muted = false` directly, so it works even when the button hasn't
  rendered yet.
- 🎬 **Only one video at a time.** Just the video you're watching gets audio;
  feed previews and preloaded reels are muted, so you never get two reels
  playing over each other.
- 🔄 **Doesn't restart what you're watching.** A reel you're halfway through
  keeps playing. Only a genuinely new video is rewound to the start.
- 🧩 **Leaves the page alone.** It reads and toggles a `muted` attribute, nothing
  more — no injected UI, no changes to Facebook's own elements.
- 🌍 **Works in your language.** Unmute button labels are configurable, so a
  non-English Facebook UI can be supported.

## Installation

### Option A — one-click (recommended)

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/)
   or [Violentmonkey](https://violentmonkey.github.io/).
2. Open the raw script and your manager will offer to install it:
   **[Install Auto-Unmute-Facebook.user.js](https://raw.githubusercontent.com/poorloading/facebook-auto-unmute/main/Auto-Unmute-Facebook.user.js)**
3. Confirm the install, then open [facebook.com](https://www.facebook.com) — it
   runs automatically.

Because the script declares `@updateURL` / `@downloadURL`, your manager will
check this repository for updates on its own.

### Option B — manual

1. Install [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/).
2. Open the extension → **Dashboard** → **+** (create a new script).
3. Replace the template with the contents of
   [`Auto-Unmute-Facebook.user.js`](Auto-Unmute-Facebook.user.js).
4. Save (`Ctrl`/`Cmd` + `S`) and reload Facebook.

> **Note:** manual installs are not auto-updated unless you keep the
> `@updateURL` header intact.

## Requirements

- A Chromium-based browser (Chrome, Edge, Brave, Opera) or Firefox
- [Tampermonkey](https://www.tampermonkey.net/) v4.0+ or
  [Violentmonkey](https://violentmonkey.github.io/) v2.12+
- Runs on `https://*.facebook.com/*`; no special `@grant` permissions are
  requested

`Element.checkVisibility()` is used where available (Chrome 105+, Firefox 113+,
Safari 16.4+); older browsers fall back to a box-size check.

## Usage

Once installed it runs automatically — there's nothing to click.

If you want to watch it work, set `DEBUG = true` at the top of the script and
open DevTools → Console. It's off by default; every action is logged with an
`[auto-unmute]` prefix when enabled.

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

1. **`IntersectionObserver`** — the browser reports a video's on-screen fraction
   whenever it crosses one of `RATIO_THRESHOLDS`, with no measurement on our
   side. That is what drives unmuting while you scroll.
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

Under the hood, in case you're auditing it:

- No video is ever measured with `getBoundingClientRect()`; the observer
  supplies the ratio, so there's no repeated forced layout on a long feed.
- Rewind state lives in a `WeakMap` keyed on each `<video>`, garbage-collected
  with the element. No DOM stamping, no manual cleanup.
- Nothing is muted or unmuted until the observer has reported at least one
  ratio, so the script never acts on a guess at startup.
- The script makes no network requests of its own.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Nothing happens | Confirm the script is enabled in your manager's dashboard and the page is a `facebook.com` URL, then hard-reload (`Ctrl`/`Cmd` + `Shift` + `R`). |
| A reel stays muted | Browsers block a script-set `muted = false` without a recent user gesture. Click once anywhere on the page and the next run retries. |
| Audio from two videos at once | Shouldn't happen; if it does, raise `ACTIVE_VIDEO_MIN_RATIO`. |
| The unmute button never gets clicked | `aria-label="Unmute"` is the English label and Facebook localizes it (e.g. `Activer le son`). Add yours to `UNMUTE_LABELS` — the direct `muted = false` path still works without it. |
| Want to see what it's doing | Set `DEBUG = true` and open DevTools → Console. |

## Known limitations

- **Desktop web only.** Mobile apps can't run userscripts, and neither can the
  Messenger desktop app.
- **One video at a time.** A clip that is mostly off-screen won't be unmuted,
  by design. Lower `ACTIVE_VIDEO_MIN_RATIO` if that's too strict for your window
  size.
- **Autoplay policies still apply.** Chrome and Firefox may require one
  interaction with the page per session before sound is allowed at all. The
  script can't override that.
- **Facebook's markup changes.** Button labels are localized and renamed
  occasionally. When that happens, add the new label to `UNMUTE_LABELS`.

## Privacy

The script runs entirely in your browser. It reads and modifies Facebook's page
elements locally and makes **no network requests** of its own.

## Testing

The core logic runs headlessly against a stubbed DOM, so no browser is needed:

```
node test/unmute.test.js
```

It covers active-video selection, the force-mute guard, rewind-once-per-source,
and asserts that no video is ever measured for layout. No dependencies — just
Node.

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

## Contributing

Pull requests are welcome. For major changes, please open an issue first to
discuss what you'd like to change. When reporting a bug, include your browser,
userscript manager, script version, and any `DEBUG = true` console output.

## License

[MIT](LICENSE) © poorloading
