// Headless regression tests for Auto-Unmute-Facebook.user.js.
//
// Runs the userscript against a stubbed DOM, so the core logic can be checked
// without a browser, a userscript manager or any npm dependencies. The
// IntersectionObserver is faked, so on-screen fractions are driven explicitly
// instead of being measured.
//
// Usage: node test/unmute.test.js
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'Auto-Unmute-Facebook.user.js');

// A fake page: stubbed DOM plus the handles needed to drive it.
function createPage() {
    const layout = { reads: 0 };
    const timers = [];
    let nextTimer = 1;
    let intervalFn = null;
    let io = null;

    const videos = [];

    const document = {
        body: {},
        documentElement: {},
        querySelectorAll(selector) {
            return String(selector).trim() === 'video' ? videos : [];
        },
        addEventListener() {},
    };

    class FakeIntersectionObserver {
        constructor(callback, options) {
            this.cb = callback;
            this.options = options;
            this.targets = new Set();
            io = this;
        }
        observe(el) { this.targets.add(el); }
        unobserve(el) { this.targets.delete(el); }
        disconnect() { this.targets.clear(); }
    }

    const sandbox = {
        document,
        window: { innerWidth: 1000, innerHeight: 1000 },
        IntersectionObserver: FakeIntersectionObserver,
        MutationObserver: class { observe() {} disconnect() {} },
        console: { log() {} },
        setTimeout: (fn) => { const id = nextTimer++; timers.push({ id, fn }); return id; },
        clearTimeout: (id) => {
            const i = timers.findIndex(t => t.id === id);
            if (i >= 0) timers.splice(i, 1);
        },
        setInterval: (fn) => { intervalFn = fn; return 1; },
    };

    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), sandbox, { filename: SCRIPT });

    return {
        addVideo(src) {
            const video = {
                muted: false,
                currentTime: 5,
                currentSrc: src,
                src,
                // Nothing should ever measure a video any more: the observer
                // already told us how much of it is on screen.
                getBoundingClientRect() {
                    layout.reads++;
                    throw new Error('video was measured, but the observer should have supplied the ratio');
                },
            };
            videos.push(video);
            return video;
        },
        // Report on-screen fractions the way the browser would.
        emit(pairs) {
            if (!io) throw new Error('IntersectionObserver was never constructed');
            io.cb(pairs.map(([el, ratio]) => ({
                target: el,
                isIntersecting: ratio > 0,
                intersectionRatio: ratio,
            })));
        },
        // Run the debounced apply that an observer callback schedules.
        flush() {
            timers.splice(0, timers.length).forEach(t => t.fn());
        },
        // Run the low-frequency safety-net pass.
        runSafetyNet() {
            if (!intervalFn) throw new Error('setInterval was never called');
            intervalFn();
        },
        layoutReads() { return layout.reads; },
    };
}

// --- runner ----------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('  pass  ' + name);
    } catch (err) {
        failed++;
        console.log('  FAIL  ' + name);
        console.log('        ' + err.message);
    }
}

function assert(cond, message) {
    if (!cond) throw new Error(message);
}

// --- active video ----------------------------------------------------------

test('unmutes the most on-screen video', () => {
    const page = createPage();
    const active = page.addVideo('reel-1');
    const behind = page.addVideo('reel-2');

    page.emit([[active, 1], [behind, 0]]);
    page.flush();

    assert(active.muted === false, 'active video should be unmuted');
});

test('force-mutes offscreen videos so audio does not overlap', () => {
    const page = createPage();
    const active = page.addVideo('reel-1');
    const behind = page.addVideo('reel-2');

    page.emit([[active, 1], [behind, 0]]);
    page.flush();

    assert(behind.muted === true, 'offscreen video should be muted');
});

test('follows scrolling to a different video', () => {
    const page = createPage();
    const first = page.addVideo('reel-1');
    const second = page.addVideo('reel-2');

    page.emit([[first, 1], [second, 0]]);
    page.flush();
    assert(first.muted === false && second.muted === true, 'first reel should be the active one');

    page.emit([[first, 0.02], [second, 0.95]]); // scrolled to the next reel
    page.flush();

    assert(second.muted === false, 'the newly visible reel should be unmuted');
    assert(first.muted === true, 'the reel scrolled away should be muted');
});

test('leaves the other players alone when nothing clears the threshold', () => {
    const page = createPage();
    const a = page.addVideo('a');
    const b = page.addVideo('b');

    page.emit([[a, 0.13], [b, 0.05]]); // both barely on screen
    page.flush();

    assert(b.muted === false, 'a partially visible neighbour should not be muted');
});

test('does not touch mute state before the observer has reported', () => {
    const page = createPage();
    const video = page.addVideo('reel-1');

    page.flush(); // the delayed startup run fires with no measurements yet

    assert(video.muted === false, 'acting before any ratio is known would be a guess');
});

// --- rewind ----------------------------------------------------------------

test('rewinds a newly seen video once', () => {
    const page = createPage();
    const active = page.addVideo('reel-1');

    page.emit([[active, 1]]);
    page.flush();

    assert(active.currentTime === 0, 'expected currentTime to be rewound to 0');
});

test('does not rewind a video that is already playing', () => {
    const page = createPage();
    const active = page.addVideo('reel-1');

    page.emit([[active, 1]]);
    page.flush();

    active.currentTime = 7;
    page.runSafetyNet();

    assert(active.currentTime === 7, 'mid-playback video must not be interrupted');
});

test('rewinds a reused element again when its source changes', () => {
    const page = createPage();
    const active = page.addVideo('reel-1');

    page.emit([[active, 1]]);
    page.flush();

    active.currentSrc = 'reel-2'; // Facebook swapped in the next reel
    active.currentTime = 7;
    page.runSafetyNet();

    assert(active.currentTime === 0, 'a new source on a reused element should rewind');
});

// --- the point of the rewrite ----------------------------------------------

test('never measures a video to decide what is visible', () => {
    const page = createPage();
    const a = page.addVideo('reel-1');
    const b = page.addVideo('reel-2');

    page.emit([[a, 0.4], [b, 0.9]]);
    page.flush();
    page.runSafetyNet();
    page.runSafetyNet();

    assert(page.layoutReads() === 0, 'expected zero layout reads, got ' + page.layoutReads());
});

// --- report ----------------------------------------------------------------

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
