/**
 * Ring view — the whole meeting as a clock-face donut. One arc per topic
 * (length ∝ duration) starting at 12 o'clock, a sweep hand at overall
 * progress, and the current topic + countdown in the center.
 */
(function () {
  'use strict';

  var MEETING = window.MEETING;
  var E = window.MeetingTimeEngine;
  var engine = E.create(MEETING);
  var tz = MEETING.time.timezone;

  var COLORS = {
    bg: 0x0b0f1a,
    ink: 0xf2f5fa,
    inkMuted: 0x8291ab,
    good: 0x27c46f,
    completed: parseInt(MEETING.config.colors.completed, 16),
    current: parseInt(MEETING.config.colors.current, 16),
    upcoming: parseInt(MEETING.config.colors.upcoming, 16)
  };
  var ALPHAS = {
    completed: 0.55,
    current: 1.0,
    upcoming: 0.35
  };
  var MONO = 'Menlo, Consolas, monospace';
  var TOP = -Math.PI / 2; // 12 o'clock

  (async () => {
    var app = new PIXI.Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: COLORS.bg,
      resolution: window.devicePixelRatio || 1,
      antialias: true
    });
    document.body.appendChild(app.canvas);
    app.canvas.style.cssText = 'width:100vw;height:100vh;position:fixed;top:0;left:0;';

    var W = app.screen.width;
    var H = app.screen.height;
    var cx = W / 2;
    var cy = H / 2;
    var R = Math.min(W, H) * 0.30;
    var thickness = Math.max(18, R * 0.16);

    var totalMs = engine.endMs - engine.startMs;

    function angleAt(ms) {
      if (totalMs <= 0) return TOP;
      return TOP + ((ms - engine.startMs) / totalMs) * Math.PI * 2;
    }

    // --- Topic arcs (repainted only on status change) ---
    var initialState = engine.getState();
    var GAP = Math.max(0.012, 2 / R); // ~2px angular gap between segments

    var arcs = initialState.segments.map(function (seg) {
      var g = new PIXI.Graphics();
      app.stage.addChild(g);
      var a0 = angleAt(seg.startMs);
      var a1 = angleAt(seg.endMs);
      // keep a visible sliver even for very short topics
      if (a1 - a0 > GAP * 2) { a0 += GAP / 2; a1 -= GAP / 2; }
      return { g: g, a0: a0, a1: a1, status: null };
    });

    function drawArc(arc, status) {
      arc.g.clear();
      arc.g.arc(cx, cy, R, arc.a0, arc.a1);
      arc.g.stroke({ width: thickness, color: COLORS[status], alpha: ALPHAS[status], cap: 'butt' });
    }

    // --- Labels at arc mid-angles, outside the ring ---
    initialState.segments.forEach(function (seg, i) {
      var mid = (arcs[i].a0 + arcs[i].a1) / 2;
      var lr = R + thickness / 2 + 16;
      var lx = cx + Math.cos(mid) * lr;
      var ly = cy + Math.sin(mid) * lr;
      var onRight = Math.cos(mid) >= 0;

      var topicName = seg.topic.length > 24 ? seg.topic.slice(0, 23) + '…' : seg.topic;
      var label = new PIXI.Text({
        text: topicName + (seg.person ? '\n' + seg.person + ' · ' + seg.minutes + 'min' : '\n' + seg.minutes + 'min'),
        style: {
          fontSize: 13,
          fill: COLORS.ink,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          align: onRight ? 'left' : 'right',
          lineHeight: 17
        }
      });
      label.anchor.set(onRight ? 0 : 1, 0.5);
      label.x = lx;
      label.y = ly;
      app.stage.addChild(label);
    });

    // --- Sweep hand + trail (redrawn each frame) ---
    var sweep = new PIXI.Graphics();
    app.stage.addChild(sweep);

    // --- Center stack ---
    var kicker = new PIXI.Text({
      text: '',
      style: { fontSize: 13, fill: COLORS.inkMuted, fontFamily: MONO, letterSpacing: 3 }
    });
    kicker.anchor.set(0.5, 1);
    kicker.x = cx;
    kicker.y = cy - R * 0.38;
    app.stage.addChild(kicker);

    var centerTopic = new PIXI.Text({
      text: '',
      style: {
        fontSize: Math.max(18, R * 0.13),
        fill: COLORS.ink,
        fontWeight: '700',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: R * 1.35,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
      }
    });
    centerTopic.anchor.set(0.5, 1);
    centerTopic.x = cx;
    centerTopic.y = cy - R * 0.02;
    app.stage.addChild(centerTopic);

    var centerPerson = new PIXI.Text({
      text: '',
      style: { fontSize: Math.max(13, R * 0.08), fill: COLORS.inkMuted, fontFamily: MONO }
    });
    centerPerson.anchor.set(0.5, 0);
    centerPerson.x = cx;
    centerPerson.y = cy + R * 0.04;
    app.stage.addChild(centerPerson);

    var centerClock = new PIXI.Text({
      text: '',
      style: { fontSize: Math.max(28, R * 0.24), fill: COLORS.ink, fontFamily: MONO, fontWeight: '700' }
    });
    centerClock.anchor.set(0.5, 0);
    centerClock.x = cx;
    centerClock.y = cy + R * 0.14;
    app.stage.addChild(centerClock);

    // Meeting title, small, above everything
    var titleText = new PIXI.Text({
      text: MEETING.title,
      style: { fontSize: 14, fill: COLORS.inkMuted, fontFamily: MONO }
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = cx;
    titleText.y = 18;
    app.stage.addChild(titleText);

    // --- Animation loop ---
    var lastArcUpdate = 0;

    engine.onFrame(function (state) {
      var t = Date.now();

      // Sweep hand + elapsed trail on the outer edge
      sweep.clear();
      var a = angleAt(state.nowMs < state.startMs ? state.startMs : Math.min(state.nowMs, state.endMs));
      if (state.overallProgress > 0.001) {
        sweep.arc(cx, cy, R + thickness / 2 + 5, TOP, a);
        sweep.stroke({ width: 3, color: 0xffffff, alpha: 0.7, cap: 'round' });
      }
      var hx = cx + Math.cos(a) * (R + thickness / 2 + 5);
      var hy = cy + Math.sin(a) * (R + thickness / 2 + 5);
      sweep.moveTo(cx + Math.cos(a) * (R - thickness / 2 - 4), cy + Math.sin(a) * (R - thickness / 2 - 4));
      sweep.lineTo(hx, hy);
      sweep.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      sweep.circle(hx, hy, 5 + Math.sin(t / 300) * 1.5);
      sweep.fill({ color: 0xffffff, alpha: 0.9 });

      // Center stack
      if (state.phase === 'pre') {
        kicker.text = 'T-MINUS';
        kicker.style.fill = COLORS.inkMuted;
        centerTopic.text = MEETING.title;
        centerPerson.text = 'starts ' + E.formatWallClock(state.startMs, tz);
        centerClock.text = E.formatCountdown(-state.msUntilStart);
        centerClock.style.fill = COLORS.ink;
      } else if (state.phase === 'complete') {
        kicker.text = 'COMPLETE';
        kicker.style.fill = COLORS.good;
        centerTopic.text = '🎉';
        centerPerson.text = MEETING.topics.length + ' topics · ' + MEETING.time.totalMinutes + ' min';
        centerClock.text = 'DONE';
        centerClock.style.fill = COLORS.good;
      } else if (state.current) {
        kicker.text = 'NOW';
        kicker.style.fill = COLORS.current;
        centerTopic.text = state.current.topic;
        centerPerson.text = state.current.person || '';
        centerClock.text = E.formatMMSS(state.current.msRemaining);
        centerClock.style.fill = state.current.msRemaining < 60000 ? COLORS.current : COLORS.ink;
      } else {
        kicker.text = 'UP NEXT';
        kicker.style.fill = COLORS.inkMuted;
        centerTopic.text = state.next ? state.next.topic : '';
        centerPerson.text = state.next ? (state.next.person || '') : '';
        centerClock.text = state.next ? E.formatMMSS(state.next.startMs - state.nowMs) : '';
        centerClock.style.fill = COLORS.ink;
      }

      // Arc status repaints (throttled) + current-arc pulse
      if (t - lastArcUpdate > 500) {
        lastArcUpdate = t;
        state.segments.forEach(function (seg, i) {
          if (arcs[i].status !== seg.status) {
            arcs[i].status = seg.status;
            drawArc(arcs[i], seg.status);
          }
        });
      }
      state.segments.forEach(function (seg, i) {
        arcs[i].g.alpha = seg.status === 'current' ? 0.85 + Math.sin(t / 400) * 0.15 : 1;
      });
    });
  })().catch(console.error);
})();
