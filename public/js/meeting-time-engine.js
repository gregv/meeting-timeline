/**
 * MeetingTimeEngine — shared "where are we in the meeting" logic for every
 * visualization view. Consumes the normalized window.MEETING payload
 * (ISO 8601 times computed server-side) and exposes a pure state snapshot so
 * all views agree on phase, current topic, and progress.
 *
 * Zero dependencies: native Date only.
 */
(function (global) {
  'use strict';

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // "12:05" — minutes roll past 59 for long spans
  function formatMMSS(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    var totalSeconds = Math.floor(ms / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ':' + pad2(seconds);
  }

  // "1:02:05" or "12:05" when under an hour
  function formatHMS(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    var totalSeconds = Math.floor(ms / 1000);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    if (hours > 0) {
      return hours + ':' + pad2(minutes) + ':' + pad2(seconds);
    }
    return minutes + ':' + pad2(seconds);
  }

  // Mission-clock style: negative ms => counting down ("T-00:04:32"),
  // positive => elapsed ("T+01:12:05")
  function formatCountdown(signedMs) {
    var sign = signedMs < 0 ? 'T-' : 'T+';
    var ms = Math.abs(signedMs);
    var totalSeconds = Math.floor(ms / 1000);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    return sign + pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
  }

  // "10:05 AM" in the meeting's timezone (falls back to viewer-local)
  function formatWallClock(ms, tz) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz || undefined
      }).format(new Date(ms));
    } catch (e) {
      // Unknown timezone string — use the viewer's local time
      return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(ms));
    }
  }

  function create(payload) {
    var startMs = Date.parse(payload.time.startISO);
    var endMs = Date.parse(payload.time.endISO);

    var baseSegments = (payload.topics || []).map(function (topic, index) {
      return {
        index: index,
        id: topic.id,
        person: topic.person,
        topic: topic.topic,
        minutes: topic.minutes,
        startMs: Date.parse(topic.startISO),
        endMs: Date.parse(topic.endISO)
      };
    });

    function getState(nowMs) {
      if (nowMs === undefined) nowMs = Date.now();

      var phase = nowMs < startMs ? 'pre' : (nowMs >= endMs ? 'complete' : 'active');
      var currentIndex = -1;
      var next = null;

      var segments = baseSegments.map(function (seg) {
        var status;
        if (nowMs >= seg.endMs) {
          status = 'completed';
        } else if (nowMs >= seg.startMs) {
          status = 'current';
        } else {
          status = 'upcoming';
        }

        var duration = seg.endMs - seg.startMs;
        var progress;
        if (duration <= 0) {
          progress = nowMs >= seg.endMs ? 1 : 0;
        } else {
          progress = clamp01((nowMs - seg.startMs) / duration);
        }

        return {
          index: seg.index,
          id: seg.id,
          person: seg.person,
          topic: seg.topic,
          minutes: seg.minutes,
          startMs: seg.startMs,
          endMs: seg.endMs,
          status: status,
          progress: progress,
          msElapsed: Math.max(0, Math.min(nowMs, seg.endMs) - seg.startMs),
          msRemaining: Math.max(0, seg.endMs - Math.max(nowMs, seg.startMs))
        };
      });

      for (var i = 0; i < segments.length; i++) {
        if (segments[i].status === 'current' && currentIndex === -1) {
          currentIndex = i;
        }
        if (!next && segments[i].status === 'upcoming') {
          next = segments[i];
        }
      }

      var totalDuration = endMs - startMs;
      return {
        nowMs: nowMs,
        startMs: startMs,
        endMs: endMs,
        phase: phase,
        msUntilStart: Math.max(0, startMs - nowMs),
        msSinceStart: Math.max(0, nowMs - startMs),
        msRemainingTotal: Math.max(0, endMs - nowMs),
        overallProgress: totalDuration <= 0 ? (nowMs >= endMs ? 1 : 0) : clamp01((nowMs - startMs) / totalDuration),
        currentIndex: currentIndex,
        current: currentIndex >= 0 ? segments[currentIndex] : null,
        next: next,
        segments: segments
      };
    }

    // setInterval-driven updates for DOM views. Fires immediately once.
    function onTick(callback, intervalMs) {
      if (intervalMs === undefined) intervalMs = 250;
      callback(getState());
      var timer = setInterval(function () {
        callback(getState());
      }, intervalMs);
      return function unsubscribe() {
        clearInterval(timer);
      };
    }

    // requestAnimationFrame-driven updates for canvas views.
    function onFrame(callback) {
      var running = true;
      function frame() {
        if (!running) return;
        callback(getState());
        global.requestAnimationFrame(frame);
      }
      global.requestAnimationFrame(frame);
      return function unsubscribe() {
        running = false;
      };
    }

    return {
      startMs: startMs,
      endMs: endMs,
      getState: getState,
      onTick: onTick,
      onFrame: onFrame
    };
  }

  global.MeetingTimeEngine = {
    create: create,
    formatMMSS: formatMMSS,
    formatHMS: formatHMS,
    formatCountdown: formatCountdown,
    formatWallClock: formatWallClock
  };
})(window);
