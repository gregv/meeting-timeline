/**
 * Rail view — vertical subway-map agenda. One stop per topic on a continuous
 * line, a white "now" dot riding the rail, the current stop pulsing.
 * Mobile-first: attendees keep this open on a phone.
 */
(function () {
  'use strict';

  var MEETING = window.MEETING;
  var E = window.MeetingTimeEngine;
  var engine = E.create(MEETING);
  var tz = MEETING.time.timezone;

  var colors = MEETING.config.colors;
  var rootStyle = document.documentElement.style;
  rootStyle.setProperty('--status-completed', '#' + colors.completed);
  rootStyle.setProperty('--status-current', '#' + colors.current);
  rootStyle.setProperty('--status-upcoming', '#' + colors.upcoming);

  var root = document.getElementById('viewRoot');
  var clockEl = document.getElementById('mvClock');
  var phaseEl = document.getElementById('mvPhase');
  var subtitleEl = document.getElementById('mvSubtitle');

  var list = document.createElement('ul');
  list.className = 'rail-list';

  var stops = MEETING.topics.map(function (topic) {
    var li = document.createElement('li');
    li.className = 'rail-stop is-upcoming';

    var time = document.createElement('div');
    time.className = 'rail-time';
    time.textContent = E.formatWallClock(Date.parse(topic.startISO), tz);

    var dot = document.createElement('div');
    dot.className = 'rail-dot';

    var body = document.createElement('div');
    body.className = 'rail-body';

    var person = document.createElement('div');
    person.className = 'rail-person';
    person.textContent = topic.person || '';

    var name = document.createElement('div');
    name.className = 'rail-topic';
    name.textContent = topic.topic;

    var meta = document.createElement('div');
    meta.className = 'rail-meta';
    meta.textContent = topic.minutes + ' min';

    var progress = document.createElement('div');
    progress.className = 'rail-progress';
    progress.innerHTML = '<span></span>';

    body.appendChild(person);
    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(progress);

    li.appendChild(time);
    li.appendChild(dot);
    li.appendChild(body);
    list.appendChild(li);

    return {
      li: li,
      dot: dot,
      meta: meta,
      baseMeta: topic.minutes + ' min',
      progressBar: progress.querySelector('span')
    };
  });

  // Terminus marker
  var end = document.createElement('li');
  end.className = 'rail-end';
  end.innerHTML = '<div class="rail-time"></div><div class="rail-end-label">🏁 END · ' +
    E.formatWallClock(engine.endMs, tz) + '</div>';
  list.appendChild(end);

  // The interpolated "now" marker
  var nowDot = document.createElement('div');
  nowDot.className = 'rail-now';
  list.appendChild(nowDot);

  root.appendChild(list);

  var lastStatuses = [];
  var lastCurrentIndex = -2;

  function positionNowDot(state) {
    var top;
    if (state.phase === 'pre' && stops.length) {
      top = stops[0].li.offsetTop + 18;
    } else if (state.phase === 'complete') {
      top = end.offsetTop + 14;
    } else if (state.currentIndex >= 0) {
      var li = stops[state.currentIndex].li;
      var seg = state.segments[state.currentIndex];
      var nextTop = state.currentIndex + 1 < stops.length
        ? stops[state.currentIndex + 1].li.offsetTop
        : end.offsetTop;
      top = li.offsetTop + 18 + seg.progress * (nextTop - li.offsetTop - 18);
    } else if (state.next) {
      top = stops[state.next.index].li.offsetTop + 10;
    } else {
      top = end.offsetTop + 14;
    }
    nowDot.style.top = top + 'px';
  }

  engine.onTick(function (state) {
    // Header
    if (state.phase === 'pre') {
      phaseEl.textContent = 'STARTS SOON';
      phaseEl.className = 'mv-phase';
      clockEl.textContent = E.formatCountdown(-state.msUntilStart);
      subtitleEl.textContent = 'Starts at ' + E.formatWallClock(state.startMs, tz);
    } else if (state.phase === 'complete') {
      phaseEl.textContent = 'COMPLETE';
      phaseEl.className = 'mv-phase is-complete';
      clockEl.textContent = '🎉 DONE';
      subtitleEl.textContent = 'Ended at ' + E.formatWallClock(state.endMs, tz);
    } else {
      phaseEl.textContent = 'LIVE';
      phaseEl.className = 'mv-phase is-live';
      clockEl.textContent = E.formatCountdown(state.msSinceStart);
      subtitleEl.textContent = E.formatHMS(state.msRemainingTotal) + ' remaining';
    }

    state.segments.forEach(function (seg, i) {
      var stop = stops[i];
      if (!stop) return;

      if (lastStatuses[i] !== seg.status) {
        lastStatuses[i] = seg.status;
        stop.li.className = 'rail-stop is-' + seg.status;
        stop.dot.textContent = seg.status === 'completed' ? '✓' : '';
      }

      if (seg.status === 'current') {
        stop.meta.textContent = E.formatMMSS(seg.msRemaining) + ' left of ' + stop.baseMeta;
        stop.progressBar.style.width = (seg.progress * 100).toFixed(1) + '%';
      } else if (stop.meta.textContent !== stop.baseMeta) {
        stop.meta.textContent = stop.baseMeta;
      }
    });

    positionNowDot(state);

    // Keep the active stop centered as the meeting progresses
    if (state.currentIndex !== lastCurrentIndex) {
      lastCurrentIndex = state.currentIndex;
      if (state.currentIndex >= 0) {
        stops[state.currentIndex].li.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, 250);
})();
