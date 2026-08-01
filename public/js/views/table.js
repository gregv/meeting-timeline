/**
 * Table view — live dashboard table for screen-sharing during the meeting.
 * Status | Who | Topic | Allotted | Starts | Remaining, with the current row
 * highlighted, an inline progress bar, and a big countdown cell.
 */
(function () {
  'use strict';

  var MEETING = window.MEETING;
  var E = window.MeetingTimeEngine;
  var engine = E.create(MEETING);
  var tz = MEETING.time.timezone;

  // Apply the meeting's configured status colors
  var colors = MEETING.config.colors;
  var rootStyle = document.documentElement.style;
  rootStyle.setProperty('--status-completed', '#' + colors.completed);
  rootStyle.setProperty('--status-current', '#' + colors.current);
  rootStyle.setProperty('--status-upcoming', '#' + colors.upcoming);

  var root = document.getElementById('viewRoot');
  var clockEl = document.getElementById('mvClock');
  var phaseEl = document.getElementById('mvPhase');
  var subtitleEl = document.getElementById('mvSubtitle');

  var STATUS_TEXT = {
    completed: '✓ DONE',
    current: '▶ NOW',
    upcoming: '○ NEXT'
  };

  // Build the table once
  var table = document.createElement('table');
  table.className = 'agenda-table';
  table.innerHTML =
    '<thead><tr>' +
    '<th>Status</th><th>Who</th><th>Topic</th>' +
    '<th>Allotted</th><th>Starts</th><th>Remaining</th>' +
    '</tr></thead>';
  var tbody = document.createElement('tbody');

  var rows = MEETING.topics.map(function (topic) {
    var tr = document.createElement('tr');

    var tdStatus = document.createElement('td');
    tdStatus.innerHTML = '<span class="row-status"><span class="status-dot"></span><span class="status-text"></span></span>';

    var tdPerson = document.createElement('td');
    tdPerson.textContent = topic.person || '—';

    var tdTopic = document.createElement('td');
    tdTopic.className = 'cell-topic';
    var topicName = document.createElement('div');
    topicName.textContent = topic.topic;
    var progress = document.createElement('div');
    progress.className = 'row-progress';
    progress.innerHTML = '<span></span>';
    tdTopic.appendChild(topicName);
    tdTopic.appendChild(progress);

    var tdAllotted = document.createElement('td');
    tdAllotted.className = 'cell-num';
    tdAllotted.textContent = topic.minutes + ' min';

    var tdStarts = document.createElement('td');
    tdStarts.className = 'cell-num';
    tdStarts.textContent = E.formatWallClock(Date.parse(topic.startISO), tz);

    var tdRemaining = document.createElement('td');
    tdRemaining.className = 'cell-num cell-remaining';
    tdRemaining.textContent = '—';

    tr.appendChild(tdStatus);
    tr.appendChild(tdPerson);
    tr.appendChild(tdTopic);
    tr.appendChild(tdAllotted);
    tr.appendChild(tdStarts);
    tr.appendChild(tdRemaining);
    tbody.appendChild(tr);

    return {
      tr: tr,
      statusText: tdStatus.querySelector('.status-text'),
      progressBar: progress.querySelector('span'),
      remaining: tdRemaining
    };
  });

  table.appendChild(tbody);
  root.appendChild(table);

  var footer = document.createElement('div');
  footer.className = 'table-footer';
  footer.textContent = MEETING.topics.length + ' topics · ' + MEETING.time.totalMinutes + ' min total · ' +
    E.formatWallClock(engine.startMs, tz) + ' – ' + E.formatWallClock(engine.endMs, tz) +
    (tz ? ' (' + tz + ')' : '');
  root.appendChild(footer);

  var lastStatuses = [];

  engine.onTick(function (state) {
    // Header clock + phase
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
      subtitleEl.textContent = E.formatHMS(state.msRemainingTotal) + ' remaining · ends ' + E.formatWallClock(state.endMs, tz);
    }

    state.segments.forEach(function (seg, i) {
      var row = rows[i];
      if (!row) return;

      if (lastStatuses[i] !== seg.status) {
        lastStatuses[i] = seg.status;
        row.tr.className = 'is-' + seg.status;
        row.statusText.textContent = STATUS_TEXT[seg.status];
      }

      if (seg.status === 'current') {
        row.remaining.textContent = E.formatMMSS(seg.msRemaining);
        row.progressBar.style.width = (seg.progress * 100).toFixed(1) + '%';
      } else if (seg.status === 'completed') {
        row.remaining.textContent = '✓';
      } else {
        row.remaining.textContent = '—';
      }
    });
  }, 250);
})();
