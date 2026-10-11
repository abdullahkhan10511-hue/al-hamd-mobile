/**
 * Regression Test Suite: AL-HAMD Homepage Video Playlist System
 * Scenarios A through J
 */

import assert from 'node:assert/strict';

// Helper: Playlist sorting and filtering logic matching API & component
function processPlaylist(rawItems) {
  const valid = (rawItems || []).filter((v) => {
    if (!v) return false;
    const isActive =
      (v.active === true || v.active === 1 || v.active === '1' || v.active === 'true') &&
      v.active !== false &&
      v.active !== 0 &&
      v.active !== '0' &&
      v.active !== 'false';
    const hasUrl = typeof v.url === 'string' && v.url.trim().length > 0;
    return Boolean(isActive && hasUrl);
  });
  return valid.sort((a, b) => {
    const orderA = typeof a.displayOrder === 'number' && !isNaN(a.displayOrder) ? a.displayOrder : 0;
    const orderB = typeof b.displayOrder === 'number' && !isNaN(b.displayOrder) ? b.displayOrder : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id || '').localeCompare(b.id || '');
  });
}

// Helper: Sequential playback controller simulation matching HeroSection.tsx
class HeroPlaylistSimulator {
  constructor(initialVideos = []) {
    this.videos = processPlaylist(initialVideos);
    this.currentIndex = 0;
    this.failedVideoIds = new Set();
    this.activeVideoId = this.videos[0]?.id || null;
    this.hasError = false;
  }

  getCurrentVideo() {
    if (this.videos.length === 0 || this.hasError) return null;
    return this.videos[this.currentIndex] || null;
  }

  advanceToNextVideo() {
    if (this.videos.length <= 1) return;
    let nextIdx = (this.currentIndex + 1) % this.videos.length;
    let attempts = 0;

    while (
      this.failedVideoIds.has(this.videos[nextIdx]?.id) &&
      attempts < this.videos.length
    ) {
      nextIdx = (nextIdx + 1) % this.videos.length;
      attempts++;
    }

    if (attempts >= this.videos.length) {
      this.hasError = true;
      return;
    }

    this.currentIndex = nextIdx;
    this.activeVideoId = this.videos[nextIdx]?.id || null;
  }

  handleEnded() {
    if (this.videos.length === 1) {
      // Single video loop: stays at 0
      this.currentIndex = 0;
      return;
    }
    this.advanceToNextVideo();
  }

  handleVideoError() {
    const current = this.getCurrentVideo();
    if (!current) return;
    this.failedVideoIds.add(current.id);

    const remaining = this.videos.filter((v) => !this.failedVideoIds.has(v.id));
    if (remaining.length > 0) {
      this.advanceToNextVideo();
    } else {
      this.hasError = true;
    }
  }

  updatePlaylist(newRawVideos) {
    this.videos = processPlaylist(newRawVideos);

    if (this.videos.length === 0) {
      this.currentIndex = 0;
      this.activeVideoId = null;
      return;
    }

    // Clean up failed set
    const currentIds = new Set(this.videos.map((v) => v.id));
    for (const id of this.failedVideoIds) {
      if (!currentIds.has(id)) this.failedVideoIds.delete(id);
    }

    if (this.activeVideoId) {
      const existingIdx = this.videos.findIndex((v) => v.id === this.activeVideoId);
      if (existingIdx !== -1) {
        this.currentIndex = existingIdx;
        return;
      }
    }

    // Currently playing video was deactivated or removed
    this.currentIndex = 0;
    this.hasError = false;
    this.activeVideoId = this.videos[0]?.id || null;
  }
}

async function runTests() {
  console.log('--- STARTING HOMEPAGE VIDEO PLAYLIST REGRESSION TESTS ---');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] Scenario ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Scenario ${name}:`, err.message);
    }
  }

  // A. Two active videos numbered 1 and 2: video 1 plays first, then video 2
  test('A: Two active videos numbered 1 and 2', () => {
    const raw = [
      { id: 'v1', title: 'Video 1', active: true, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: true, displayOrder: 2, url: '/v2.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    assert.equal(sim.getCurrentVideo().id, 'v1', 'Video 1 must play first');
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v2', 'Video 2 must play when Video 1 ends');
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v1', 'Video 1 must play after Video 2 ends (looping)');
  });

  // B. Video 1 is inactive and video 2 is active: only video 2 plays
  test('B: Video 1 inactive, Video 2 active', () => {
    const raw = [
      { id: 'v1', title: 'Video 1', active: false, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: true, displayOrder: 2, url: '/v2.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    assert.equal(sim.videos.length, 1, 'Only 1 active video in playlist');
    assert.equal(sim.getCurrentVideo().id, 'v2', 'Only Video 2 must play');
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v2', 'Video 2 loops seamlessly');
  });

  // C. Video 1 is active and video 2 is inactive: only video 1 plays
  test('C: Video 1 active, Video 2 inactive', () => {
    const raw = [
      { id: 'v1', title: 'Video 1', active: true, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: false, displayOrder: 2, url: '/v2.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    assert.equal(sim.videos.length, 1, 'Only 1 active video in playlist');
    assert.equal(sim.getCurrentVideo().id, 'v1', 'Only Video 1 must play');
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v1', 'Video 1 loops seamlessly');
  });

  // D. Videos stored in arbitrary database order: playback still follows configured numbering
  test('D: Arbitrary database order adheres strictly to displayOrder', () => {
    const raw = [
      { id: 'v3', title: 'Video 3', active: true, displayOrder: 3, url: '/v3.mp4' },
      { id: 'v1', title: 'Video 1', active: true, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: true, displayOrder: 2, url: '/v2.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    assert.equal(sim.getCurrentVideo().id, 'v1', 'First video must be displayOrder 1');
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v2', 'Second video must be displayOrder 2');
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v3', 'Third video must be displayOrder 3');
  });

  // E. Three active videos: playback follows 1 -> 2 -> 3 -> 1
  test('E: Three active videos follow 1 -> 2 -> 3 -> 1 sequence', () => {
    const raw = [
      { id: 'v1', title: 'Video 1', active: true, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: true, displayOrder: 2, url: '/v2.mp4' },
      { id: 'v3', title: 'Video 3', active: true, displayOrder: 3, url: '/v3.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    const sequence = [];
    for (let i = 0; i < 4; i++) {
      sequence.push(sim.getCurrentVideo().id);
      sim.handleEnded();
    }
    assert.deepEqual(sequence, ['v1', 'v2', 'v3', 'v1'], 'Sequence must cycle 1 -> 2 -> 3 -> 1');
  });

  // F. No active videos: no inactive or stale video appears; container remains black
  test('F: No active videos results in empty playlist (solid black)', () => {
    const raw = [
      { id: 'v1', title: 'Video 1', active: false, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: false, displayOrder: 2, url: '/v2.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    assert.equal(sim.videos.length, 0, 'No videos should be in active playlist');
    assert.equal(sim.getCurrentVideo(), null, 'Current video must be null (black background)');
  });

  // G. Admin deactivates currently selected video: inactive video is not selected again
  test('G: Deactivation of currently selected video transitions to next active video', () => {
    const raw = [
      { id: 'v1', title: 'Video 1', active: true, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: true, displayOrder: 2, url: '/v2.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    assert.equal(sim.getCurrentVideo().id, 'v1', 'Starts playing Video 1');

    // Admin deactivates Video 1
    const updatedRaw = [
      { id: 'v1', title: 'Video 1', active: false, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Video 2', active: true, displayOrder: 2, url: '/v2.mp4' },
    ];
    sim.updatePlaylist(updatedRaw);

    assert.equal(sim.getCurrentVideo().id, 'v2', 'Must immediately switch away from deactivated Video 1 to Video 2');
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v2', 'Video 1 is never reselected');
  });

  // H. One video URL returns error: safely advances to next eligible video without infinite loop
  test('H: Error on one video safely advances to next playable video without infinite loop', () => {
    const raw = [
      { id: 'v1', title: 'Video 1 (Broken)', active: true, displayOrder: 1, url: '/broken.mp4' },
      { id: 'v2', title: 'Video 2 (Working)', active: true, displayOrder: 2, url: '/v2.mp4' },
    ];
    const sim = new HeroPlaylistSimulator(raw);
    assert.equal(sim.getCurrentVideo().id, 'v1');
    // Simulate error on v1
    sim.handleVideoError();
    assert.equal(sim.getCurrentVideo().id, 'v2', 'Must skip broken v1 to v2');
    assert.equal(sim.failedVideoIds.has('v1'), true, 'v1 tracked in failed set');

    // Ending v2: since v1 is marked failed, it should not switch back to v1
    sim.handleEnded();
    assert.equal(sim.getCurrentVideo().id, 'v2', 'Continues on eligible v2 without crashing or looping broken v1');
  });

  // I. Playlist API fails temporarily: no crash and handles empty playlist cleanly
  test('I: API failure response handled gracefully without crash', () => {
    // Simulating API 500 error returning empty array
    const emptyOnFailure = [];
    const sim = new HeroPlaylistSimulator(emptyOnFailure);
    assert.equal(sim.getCurrentVideo(), null, 'Gracefully handles empty without crashing');
    assert.equal(sim.hasError, false, 'Initial state clean');
  });

  // J. Reloading the homepage does not restore inactive video via stale cached data
  test('J: Inactive videos never present in API output or active playlist', () => {
    const mockDbVideos = [
      { id: 'v1', title: 'Deactivated Video', active: 0, displayOrder: 1, url: '/v1.mp4' },
      { id: 'v2', title: 'Active Video', active: 1, displayOrder: 2, url: '/v2.mp4' },
    ];

    // Testing API transformation
    const activeFromDb = mockDbVideos.filter((v) => Boolean(v.active));
    const processed = processPlaylist(activeFromDb);

    assert.equal(processed.length, 1);
    assert.equal(processed[0].id, 'v2');
    assert.equal(processed.some((v) => v.id === 'v1'), false, 'Deactivated video is never restored');
  });

  console.log(`\nTEST SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
