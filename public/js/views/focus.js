/**
 * Focus view — minimal full-screen display: current topic + speaker + a giant
 * countdown + up next. Meant to sit in a small window (or a second monitor)
 * during the meeting.
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

  root.innerHTML =
    '<div class="focus-kicker" id="fKicker"></div>' +
    '<div class="focus-person" id="fPerson"></div>' +
    '<div class="focus-topic" id="fTopic"></div>' +
    '<div class="focus-countdown" id="fCountdown"></div>' +
    '<div class="focus-progress" id="fProgressWrap"><span id="fProgress"></span></div>' +
    '<div class="focus-next" id="fNext"></div>';

  var kicker = document.getElementById('fKicker');
  var person = document.getElementById('fPerson');
  var topic = document.getElementById('fTopic');
  var countdown = document.getElementById('fCountdown');
  var progressWrap = document.getElementById('fProgressWrap');
  var progress = document.getElementById('fProgress');
  var next = document.getElementById('fNext');

  function nextLine(seg) {
    if (!seg) return '';
    return 'Up next: <strong>' + escapeHtml(seg.person ? seg.person + ' — ' : '') + escapeHtml(seg.topic) + '</strong>';
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  engine.onTick(function (state) {
    if (state.phase === 'pre') {
      kicker.className = 'focus-kicker';
      kicker.textContent = 'Starting at ' + E.formatWallClock(state.startMs, tz);
      person.textContent = '';
      topic.textContent = MEETING.title;
      countdown.className = 'focus-countdown';
      countdown.textContent = E.formatCountdown(-state.msUntilStart);
      progressWrap.style.visibility = 'hidden';
      next.innerHTML = nextLine(state.next);
      return;
    }

    if (state.phase === 'complete') {
      kicker.className = 'focus-kicker is-complete';
      kicker.textContent = 'Meeting complete';
      person.textContent = '';
      topic.textContent = MEETING.title;
      countdown.className = 'focus-countdown';
      countdown.textContent = '🎉';
      progressWrap.style.visibility = 'hidden';
      next.textContent = 'All ' + MEETING.topics.length + ' topics covered in ' + MEETING.time.totalMinutes + ' minutes.';
      return;
    }

    // Active
    progressWrap.style.visibility = 'visible';
    if (state.current) {
      kicker.className = 'focus-kicker is-live';
      kicker.textContent = 'Now';
      person.textContent = state.current.person || '';
      topic.textContent = state.current.topic;
      countdown.className = 'focus-countdown' + (state.current.msRemaining < 60000 ? ' is-overtime' : '');
      countdown.textContent = E.formatMMSS(state.current.msRemaining);
      progress.style.width = (state.current.progress * 100).toFixed(1) + '%';
      next.innerHTML = nextLine(state.next);
    } else {
      // In a gap between topics (legacy buffer rows)
      kicker.className = 'focus-kicker is-live';
      kicker.textContent = 'Interlude';
      person.textContent = '';
      topic.textContent = state.next ? 'Coming up: ' + (state.next.person ? state.next.person + ' — ' : '') + state.next.topic : MEETING.title;
      countdown.className = 'focus-countdown';
      countdown.textContent = state.next ? E.formatMMSS(state.next.startMs - state.nowMs) : E.formatCountdown(state.msSinceStart);
      progress.style.width = (state.overallProgress * 100).toFixed(1) + '%';
      next.textContent = '';
    }
  }, 250);
})();
