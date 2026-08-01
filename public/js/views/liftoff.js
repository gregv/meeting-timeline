/**
 * Liftoff view — SpaceX-webcast-style mission timeline. A thin line low on
 * screen with milestone nodes per topic, a rocket riding the line at overall
 * progress, a starfield, and a big T-/T+ mission clock top-center.
 */
(function () {
  'use strict';

  var MEETING = window.MEETING;
  var E = window.MeetingTimeEngine;
  var engine = E.create(MEETING);
  var tz = MEETING.time.timezone;

  var COLORS = {
    bg: 0x0b0f1a,
    line: 0x2a3550,
    ink: 0xf2f5fa,
    inkMuted: 0x8291ab,
    good: 0x27c46f,
    trail: 0xffffff,
    completed: parseInt(MEETING.config.colors.completed, 16),
    current: parseInt(MEETING.config.colors.current, 16),
    upcoming: parseInt(MEETING.config.colors.upcoming, 16)
  };
  var MONO = 'Menlo, Consolas, monospace';

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

    // --- Starfield ---
    var starLayer = new PIXI.Container();
    app.stage.addChild(starLayer);
    var stars = [];
    var starCount = Math.floor((W * H) / 12000);
    for (var s = 0; s < starCount; s++) {
      var star = new PIXI.Graphics();
      var size = Math.random() < 0.85 ? 1 : 2;
      star.circle(0, 0, size);
      star.fill({ color: 0xffffff, alpha: 1 });
      star.x = Math.random() * W;
      star.y = Math.random() * H;
      star.alpha = 0.15 + Math.random() * 0.5;
      star.baseAlpha = star.alpha;
      star.phase = Math.random() * Math.PI * 2;
      star.speed = 0.4 + Math.random() * 0.8;
      starLayer.addChild(star);
      stars.push(star);
    }

    // --- Timeline geometry: nodes at time-proportional positions ---
    var lineY = H * 0.78;
    var lineStartX = W * 0.07;
    var lineEndX = W * 0.93;
    var lineWidth = lineEndX - lineStartX;
    var totalMs = engine.endMs - engine.startMs;

    function xAt(ms) {
      if (totalMs <= 0) return lineStartX;
      return lineStartX + ((ms - engine.startMs) / totalMs) * lineWidth;
    }

    // Base line
    var baseLine = new PIXI.Graphics();
    baseLine.moveTo(lineStartX, lineY);
    baseLine.lineTo(lineEndX, lineY);
    baseLine.stroke({ width: 2, color: COLORS.line });
    app.stage.addChild(baseLine);

    // Progress trail (redrawn each frame)
    var trail = new PIXI.Graphics();
    app.stage.addChild(trail);

    // --- Milestone nodes: one per topic start + terminus ---
    var initialState = engine.getState();
    var nodes = initialState.segments.map(function (seg) {
      var container = new PIXI.Container();
      container.x = xAt(seg.startMs);
      container.y = lineY;

      var halo = new PIXI.Graphics();
      halo.circle(0, 0, 14);
      halo.fill({ color: COLORS.current, alpha: 0 });
      container.addChild(halo);

      var dot = new PIXI.Graphics();
      container.addChild(dot);

      // Rotated milestone label (SpaceX style), anchored just above the node
      var labelText = (seg.topic || '').toUpperCase();
      if (labelText.length > 22) labelText = labelText.slice(0, 21) + '…';
      var label = new PIXI.Text({
        text: labelText,
        style: { fontSize: 13, fill: COLORS.ink, fontFamily: MONO, fontWeight: '600' }
      });
      label.anchor.set(0, 0.5);
      label.rotation = -0.6;
      label.x = 4;
      label.y = -18;
      container.addChild(label);

      // Person + wall-clock time below the line
      var sub = new PIXI.Text({
        text: (seg.person ? seg.person + ' · ' : '') + E.formatWallClock(seg.startMs, tz),
        style: { fontSize: 11, fill: COLORS.inkMuted, fontFamily: MONO }
      });
      sub.anchor.set(0.5, 0);
      sub.y = 14;
      container.addChild(sub);

      app.stage.addChild(container);
      return { container: container, dot: dot, halo: halo, label: label, status: null };
    });

    // Terminus node
    var endNode = new PIXI.Graphics();
    endNode.circle(0, 0, 6);
    endNode.stroke({ width: 2, color: COLORS.inkMuted });
    endNode.x = lineEndX;
    endNode.y = lineY;
    app.stage.addChild(endNode);
    var endLabel = new PIXI.Text({
      text: '🏁 ' + E.formatWallClock(engine.endMs, tz),
      style: { fontSize: 11, fill: COLORS.inkMuted, fontFamily: MONO }
    });
    endLabel.anchor.set(0.5, 0);
    endLabel.x = lineEndX;
    endLabel.y = lineY + 14;
    app.stage.addChild(endLabel);

    function drawNode(node, status) {
      var dot = node.dot;
      dot.clear();
      if (status === 'completed') {
        dot.circle(0, 0, 7);
        dot.fill({ color: COLORS.completed, alpha: 0.9 });
        dot.stroke({ width: 2, color: COLORS.good, alpha: 0.9 });
        node.label.style.fill = COLORS.inkMuted;
      } else if (status === 'current') {
        dot.circle(0, 0, 9);
        dot.fill({ color: COLORS.current, alpha: 1 });
        dot.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
        node.label.style.fill = COLORS.ink;
      } else {
        dot.circle(0, 0, 7);
        dot.fill({ color: COLORS.bg, alpha: 1 });
        dot.stroke({ width: 2, color: COLORS.upcoming, alpha: 0.9 });
        node.label.style.fill = COLORS.inkMuted;
      }
    }

    // --- Rocket indicator riding the line ---
    var rocketHalo = new PIXI.Graphics();
    rocketHalo.circle(0, 0, 16);
    rocketHalo.fill({ color: 0xffffff, alpha: 0.15 });
    rocketHalo.y = lineY;
    app.stage.addChild(rocketHalo);

    var rocket = new PIXI.Text({
      text: '🚀',
      style: { fontSize: 26 }
    });
    rocket.anchor.set(0.5);
    rocket.rotation = Math.PI / 4; // glyph points up-right; rotate to travel right
    rocket.y = lineY;
    app.stage.addChild(rocket);

    // --- Mission clock stack (top center) ---
    var titleText = new PIXI.Text({
      text: MEETING.title.toUpperCase(),
      style: { fontSize: 15, fill: COLORS.inkMuted, fontFamily: MONO, letterSpacing: 4 }
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = W / 2;
    titleText.y = H * 0.08;
    app.stage.addChild(titleText);

    var clockText = new PIXI.Text({
      text: 'T-00:00:00',
      style: { fontSize: Math.min(96, W / 12), fill: COLORS.ink, fontFamily: MONO, fontWeight: '700' }
    });
    clockText.anchor.set(0.5, 0);
    clockText.x = W / 2;
    clockText.y = H * 0.11;
    app.stage.addChild(clockText);

    var statusText = new PIXI.Text({
      text: '',
      style: { fontSize: 17, fill: COLORS.inkMuted, fontFamily: MONO }
    });
    statusText.anchor.set(0.5, 0);
    statusText.x = W / 2;
    statusText.y = H * 0.11 + clockText.height + 14;
    app.stage.addChild(statusText);

    // --- Animation loop ---
    var lastNodeUpdate = 0;

    engine.onFrame(function (state) {
      var t = Date.now();

      // Starfield twinkle
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.alpha = st.baseAlpha + Math.sin(t / 1000 * st.speed + st.phase) * 0.12;
      }

      // Clock + status line
      if (state.phase === 'pre') {
        clockText.text = E.formatCountdown(-state.msUntilStart);
        clockText.style.fill = COLORS.ink;
        statusText.text = 'LIFTOFF AT ' + E.formatWallClock(state.startMs, tz) + ' · ' + MEETING.topics.length + ' MILESTONES';
        statusText.style.fill = COLORS.inkMuted;
      } else if (state.phase === 'complete') {
        clockText.text = 'MISSION COMPLETE';
        clockText.style.fill = COLORS.good;
        statusText.text = 'ALL OBJECTIVES ACHIEVED · T+' + E.formatHMS(state.endMs - state.startMs);
        statusText.style.fill = COLORS.good;
      } else {
        clockText.text = E.formatCountdown(state.msSinceStart);
        clockText.style.fill = COLORS.ink;
        if (state.current) {
          statusText.text = 'NOW: ' + (state.current.person ? state.current.person.toUpperCase() + ' — ' : '') +
            state.current.topic.toUpperCase() + ' · ' + E.formatMMSS(state.current.msRemaining) + ' LEFT';
          statusText.style.fill = COLORS.current;
        } else if (state.next) {
          statusText.text = 'NEXT: ' + state.next.topic.toUpperCase() + ' IN ' + E.formatMMSS(state.next.startMs - state.nowMs);
          statusText.style.fill = COLORS.inkMuted;
        }
      }

      // Rocket + progress trail
      var rocketX = lineStartX + state.overallProgress * lineWidth;
      rocket.x = rocketX;
      rocketHalo.x = rocketX;
      rocketHalo.alpha = 0.6 + Math.sin(t / 300) * 0.35;

      trail.clear();
      if (rocketX > lineStartX + 1) {
        trail.moveTo(lineStartX, lineY);
        trail.lineTo(rocketX, lineY);
        trail.stroke({ width: 3, color: COLORS.trail, alpha: 0.85 });
      }

      // Node states + current halo pulse (throttled)
      if (t - lastNodeUpdate > 500) {
        lastNodeUpdate = t;
        state.segments.forEach(function (seg, i) {
          var node = nodes[i];
          if (node.status !== seg.status) {
            node.status = seg.status;
            drawNode(node, seg.status);
          }
        });
      }
      state.segments.forEach(function (seg, i) {
        nodes[i].halo.alpha = seg.status === 'current' ? 0.25 + Math.sin(t / 350) * 0.2 : 0;
      });
    });
  })().catch(console.error);
})();
