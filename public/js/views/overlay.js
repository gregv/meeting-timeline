/**
 * Overlay view — the original PixiJS horizontal timeline designed for OBS
 * capture (chroma-key blue background, or true alpha with ?transparent=1).
 *
 * Extracted from the old inline views/meeting.ejs script. Timing decisions now
 * come from the shared MeetingTimeEngine so every view agrees on meeting state.
 * Expects: window.MEETING (data bridge), PIXI 8, moment (display formatting only).
 */
(function () {
  'use strict';

  const MEETING = window.MEETING;
  console.log("Raw meeting data:", MEETING);

  // Enhanced debug system - respects config setting
  const debugDiv = document.getElementById('debugContent');
  const isDebugEnabled = MEETING.config.showDebug;

  function addDebug(text) {
    console.log('DEBUG:', text);
    if (debugDiv && isDebugEnabled) {
      debugDiv.innerHTML += text + '<br>';
      debugDiv.scrollTop = debugDiv.scrollHeight; // Auto-scroll to bottom
    }
  }

  if (isDebugEnabled) {
    addDebug('🚀 Enhanced debug mode enabled');
  }

  const engine = MeetingTimeEngine.create(MEETING);
  const startTime = moment(MEETING.time.startISO);
  const endTime = moment(MEETING.time.endISO);
  const totalDurationMinutes = MEETING.time.totalMinutes;

  addDebug(`Meeting start: ${startTime.format('YYYY-MM-DD HH:mm:ss Z')}`);
  addDebug(`Meeting end: ${endTime.format('YYYY-MM-DD HH:mm:ss Z')}`);
  addDebug(`Total duration: ${totalDurationMinutes} minutes`);
  addDebug(`User timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  // Initialize PixiJS Application with proper sizing control
  (async () => {

    // Get actual viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    addDebug(`Viewport dimensions: ${viewportWidth}x${viewportHeight}`);

    // Create PixiJS application using modern initialization
    const app = new PIXI.Application();

    // Initialize with explicit dimensions. ?transparent=1 renders with a real
    // alpha channel so OBS Browser Sources need no chroma-key filter.
    const initOptions = {
      width: viewportWidth,
      height: viewportHeight,
      resolution: window.devicePixelRatio || 1
    };
    if (MEETING.transparent) {
      initOptions.backgroundAlpha = 0;
    } else {
      initOptions.background = parseInt(MEETING.background, 16);
    }
    await app.init(initOptions);

    // Append the application canvas to the document body
    document.body.appendChild(app.canvas);

    // Force canvas to fill viewport (override any CSS issues)
    app.canvas.style.width = '100vw';
    app.canvas.style.height = '100vh';
    app.canvas.style.position = 'fixed';
    app.canvas.style.top = '0';
    app.canvas.style.left = '0';

    // Wait multiple frames to ensure everything is settled
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Verify final canvas dimensions
    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;

    addDebug(`Final canvas dimensions: ${canvasWidth}x${canvasHeight}`);

    // Create main timeline container
    const timeline = new PIXI.Container();
    app.stage.addChild(timeline);
    const lineHeight = 4;
    const yPosition = canvasHeight / 2; // Center vertically in the viewport
    const startX = 50;
    const endX = canvasWidth - 100; // Leave more space on the right
    const timelineWidth = Math.max(100, endX - startX); // Ensure minimum width

    addDebug(`Timeline dimensions: ${startX} to ${endX} (width: ${timelineWidth})`);

    // Draw base timeline
    const baseTimeline = new PIXI.Graphics();
    baseTimeline.stroke({ width: lineHeight, color: 0xFFFFFF });
    baseTimeline.moveTo(startX, yPosition);
    baseTimeline.lineTo(endX, yPosition);
    timeline.addChild(baseTimeline);

    // Enhanced visual debug markers - respects config setting
    if (isDebugEnabled) {
      const debugBounds = new PIXI.Graphics();
      debugBounds.stroke({ width: 2, color: 0xFF0000, alpha: 0.5 });
      debugBounds.rect(startX - 10, yPosition - 50, timelineWidth + 20, 100);
      timeline.addChild(debugBounds);

      const centerMarker = new PIXI.Graphics();
      centerMarker.stroke({ width: 1, color: 0x00FF00 });
      centerMarker.moveTo(startX + timelineWidth / 2, yPosition - 30);
      centerMarker.lineTo(startX + timelineWidth / 2, yPosition + 30);
      timeline.addChild(centerMarker);

      const canvasCenterMarker = new PIXI.Graphics();
      canvasCenterMarker.stroke({ width: 2, color: 0x00FFFF });
      canvasCenterMarker.moveTo(0, canvasHeight / 2 - 20);
      canvasCenterMarker.lineTo(canvasWidth, canvasHeight / 2 - 20);
      canvasCenterMarker.moveTo(canvasWidth / 2, 0);
      canvasCenterMarker.lineTo(canvasWidth / 2, canvasHeight);
      app.stage.addChild(canvasCenterMarker);

      addDebug(`🎯 Enhanced debug markers added to timeline and canvas`);
    }

    // Create timeline segments for each topic with mission control aesthetics
    const segments = [];
    const segmentGlows = [];
    const labels = [];
    const timeLabels = [];
    const segmentData = []; // Store segment layout + timing data
    let currentPosition = startX;

    // Dynamic Mission Control Color Scheme from configuration
    const colors = {
      completed: parseInt(MEETING.config.colors.completed, 16),
      current: parseInt(MEETING.config.colors.current, 16),
      upcoming: parseInt(MEETING.config.colors.upcoming, 16),
      completedAlpha: MEETING.config.colors.completedAlpha,
      currentAlpha: MEETING.config.colors.currentAlpha,
      upcomingAlpha: MEETING.config.colors.upcomingAlpha
    };

    MEETING.topics.forEach((topic, index) => {
      addDebug(`Processing topic ${index}: ${topic.person} - ${topic.topic} (${topic.minutes}min)`);

      // Calculate segment width based on duration
      const segmentWidth = Math.max(50, (topic.minutes / totalDurationMinutes) * timelineWidth);
      const segmentHeight = MEETING.config.segmentHeight;
      const halfHeight = segmentHeight / 2;

      const topicStart = moment(topic.startISO);
      const topicEnd = moment(topic.endISO);

      segmentData.push({
        index: index,
        topic: topic,
        width: segmentWidth,
        position: currentPosition
      });

      // Create segment rectangle with rounded corners and depth
      const segment = new PIXI.Graphics();
      segment.roundRect(0, -halfHeight, segmentWidth, segmentHeight, 8);
      segment.fill({ color: colors.upcoming, alpha: colors.upcomingAlpha });
      segment.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.3 });
      segment.x = currentPosition;
      segment.y = yPosition;
      timeline.addChild(segment);
      segments.push(segment);

      // Create glow effect for current segment (initially hidden)
      const glow = new PIXI.Graphics();
      glow.roundRect(-5, -halfHeight - 5, segmentWidth + 10, segmentHeight + 10, 12);
      glow.fill({ color: colors.current, alpha: 0.0 });
      glow.x = currentPosition;
      glow.y = yPosition;
      timeline.addChild(glow);
      segmentGlows.push(glow);

      // Create status indicator (checkmark for completed, play for current)
      let statusIcon = null;
      if (MEETING.config.showStatusIcons) {
        statusIcon = new PIXI.Text({
          text: '○', // Circle for upcoming
          style: {
            fontSize: 16,
            fill: 0xFFFFFF,
            align: 'center'
          }
        });
        statusIcon.anchor.set(0.5);
        statusIcon.x = currentPosition + 20;
        statusIcon.y = yPosition;
        timeline.addChild(statusIcon);
      }
      segmentData[segmentData.length - 1].statusIcon = statusIcon;

      // Create topic label with configurable styling
      const label = new PIXI.Text({
        text: `${topic.person}: ${topic.topic}`,
        style: {
          fontSize: MEETING.config.blockFontSize,
          fill: 0xFFFFFF,
          align: 'center',
          wordWrap: true,
          wordWrapWidth: Math.max(segmentWidth - 40, 100),
          fontWeight: '500'
        }
      });
      label.anchor.set(0.5, 0);
      label.x = currentPosition + segmentWidth / 2;
      label.y = yPosition + halfHeight + 5;
      timeline.addChild(label);
      labels.push(label);

      // Create time label with configurable styling
      let timeLabel = null;
      if (MEETING.config.showTimeLabels) {
        timeLabel = new PIXI.Text({
          text: `${topic.minutes}min`,
          style: {
            fontSize: MEETING.config.timeLabelFontSize,
            fill: 0x00FF00, // Green like mission control
            align: 'center',
            fontFamily: 'monospace'
          }
        });
        timeLabel.anchor.set(0.5, 1);
        timeLabel.x = currentPosition + segmentWidth / 2;
        timeLabel.y = yPosition - halfHeight - 5;
        timeline.addChild(timeLabel);
      }
      timeLabels.push(timeLabel);

      // Create enhanced tooltip
      const tooltip = new PIXI.Text({
        text: `▸ ${topic.person}\n▸ ${topic.topic}\n▸ Duration: ${topic.minutes} minutes\n▸ Start: ${topicStart.format('HH:mm')}\n▸ End: ${topicEnd.format('HH:mm')}`,
        style: {
          fontSize: 11,
          fill: 0xFFFFFF,
          align: 'left',
          wordWrap: true,
          wordWrapWidth: 220,
          fontFamily: 'monospace',
          lineHeight: 16
        }
      });
      tooltip.anchor.set(0.5, 1);
      tooltip.x = currentPosition + segmentWidth / 2;
      tooltip.y = yPosition - 80;
      tooltip.visible = false;
      timeline.addChild(tooltip);

      // Add interactivity with better hover effects
      segment.eventMode = 'static';
      segment.cursor = 'pointer';
      segment.on('pointerover', () => {
        tooltip.visible = true;
      });
      segment.on('pointerout', () => {
        tooltip.visible = false;
      });

      currentPosition += segmentWidth + 10; // Larger gap for better separation
    });

    addDebug(`Created ${segments.length} timeline segments`);

    // Create configurable current time marker
    const currentTimeMarker = new PIXI.Container();
    const markerConfig = MEETING.config.timeMarker;

    // Marker line (configurable)
    if (markerConfig.showLine) {
      const markerLine = new PIXI.Graphics();
      const lineColor = parseInt(markerConfig.primaryColor, 16);
      const halfHeight = markerConfig.height / 2;

      markerLine.stroke({ width: markerConfig.lineWidth, color: lineColor });
      markerLine.moveTo(0, -halfHeight);
      markerLine.lineTo(0, halfHeight);
      currentTimeMarker.addChild(markerLine);

      // Add arrow head based on marker style
      if (markerConfig.style === "arrow") {
        const arrowSize = markerConfig.circleSize;
        markerLine.moveTo(-arrowSize, -halfHeight + arrowSize);
        markerLine.lineTo(0, -halfHeight);
        markerLine.lineTo(arrowSize, -halfHeight + arrowSize);
      }
    }

    // Marker circle (configurable)
    let markerCircle = null;
    if (markerConfig.showCircle) {
      markerCircle = new PIXI.Graphics();
      const circleColor = parseInt(markerConfig.primaryColor, 16);

      if (markerConfig.style === "modern") {
        markerCircle.circle(0, 0, markerConfig.circleSize);
        markerCircle.fill(circleColor);
      } else if (markerConfig.style === "classic") {
        markerCircle.circle(0, 0, markerConfig.circleSize);
        markerCircle.fill(circleColor);
        markerCircle.stroke({ width: 2, color: 0xFFFFFF });
      } else if (markerConfig.style === "minimal") {
        markerCircle.circle(0, 0, markerConfig.circleSize / 2);
        markerCircle.fill(circleColor);
      } else if (markerConfig.style === "arrow") {
        // Diamond shape for arrow style
        const size = markerConfig.circleSize;
        markerCircle.moveTo(0, -size);
        markerCircle.lineTo(size, 0);
        markerCircle.lineTo(0, size);
        markerCircle.lineTo(-size, 0);
        markerCircle.lineTo(0, -size);
        markerCircle.fill(circleColor);
      }

      currentTimeMarker.addChild(markerCircle);
    }

    // Glow effect (configurable)
    let glowEffect = null;
    if (markerConfig.showGlow && markerCircle) {
      glowEffect = new PIXI.Graphics();
      const glowColor = parseInt(markerConfig.secondaryColor, 16);
      const glowSize = markerConfig.circleSize * 3;

      glowEffect.circle(0, 0, glowSize);
      glowEffect.fill({ color: glowColor, alpha: 0 }); // Will be animated
      currentTimeMarker.addChildAt(glowEffect, 0); // Add behind other elements
    }

    // Create configurable time display
    const timeDisplay = new PIXI.Text({
      text: '',
      style: {
        fontSize: markerConfig.textStyle.fontSize,
        fill: parseInt(markerConfig.textStyle.color, 16),
        align: 'center',
        fontFamily: markerConfig.textStyle.fontFamily
      }
    });
    timeDisplay.anchor.set(0.5, 1);
    timeDisplay.y = -(markerConfig.height / 2) - 10;

    // Add text background if enabled
    if (markerConfig.textStyle.showBackground) {
      const textBg = new PIXI.Graphics();
      textBg.rect(-50, timeDisplay.y - markerConfig.textStyle.fontSize - 5, 100, markerConfig.textStyle.fontSize + 10);
      textBg.fill({
        color: parseInt(markerConfig.textStyle.backgroundColor, 16),
        alpha: markerConfig.textStyle.backgroundAlpha
      });
      currentTimeMarker.addChild(textBg);
    }

    currentTimeMarker.addChild(timeDisplay);

    currentTimeMarker.y = yPosition;
    timeline.addChild(currentTimeMarker);

    addDebug(`Time marker configured: ${markerConfig.style} style, ${markerConfig.primaryColor} primary`);

    // Enhanced zoom and pan functionality with scroll-based zoom
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let currentScale = 1;

    // Calculate optimal initial scale to fit timeline with padding
    const optimalScale = Math.min(1, (canvasWidth - 200) / timelineWidth);
    currentScale = optimalScale;
    timeline.scale.set(currentScale);

    // Perfect centering - timeline centered horizontally
    timeline.x = (canvasWidth - timelineWidth * currentScale) / 2;
    timeline.y = 0; // Timeline elements are positioned relative to yPosition already

    // Set up interactive stage for drag functionality
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', onDragStart)
      .on('pointerup', onDragEnd)
      .on('pointerupoutside', onDragEnd)
      .on('pointermove', onDragMove);

    // Add scroll-based zoom functionality
    app.canvas.addEventListener('wheel', onWheel, { passive: false });

    function onDragStart(event) {
      isDragging = true;
      dragStart = { x: event.global.x - timeline.x, y: event.global.y - timeline.y };
    }

    function onDragEnd() {
      isDragging = false;
    }

    function onDragMove(event) {
      if (isDragging) {
        timeline.x = event.global.x - dragStart.x;
        timeline.y = event.global.y - dragStart.y;
      }
    }

    // Modern scroll-based zoom with smooth scaling
    function onWheel(event) {
      event.preventDefault();

      // Get mouse position relative to the canvas
      const rect = app.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Determine zoom direction and factor
      const zoomIntensity = 0.1;
      const wheelDirection = event.deltaY > 0 ? -1 : 1; // Reverse for natural zoom feel
      const zoomFactor = 1 + (wheelDirection * zoomIntensity);

      // Calculate new scale with limits
      const newScale = Math.max(0.1, Math.min(5, currentScale * zoomFactor));

      if (newScale !== currentScale) {
        // Calculate the world position under the mouse
        const worldPos = {
          x: (mouseX - timeline.x) / currentScale,
          y: (mouseY - timeline.y) / currentScale
        };

        // Update scale
        currentScale = newScale;
        timeline.scale.set(currentScale);

        // Adjust position to keep mouse point fixed during zoom
        timeline.x = mouseX - worldPos.x * currentScale;
        timeline.y = mouseY - worldPos.y * currentScale;

        // Track zoom interaction for analytics
        if (window.analytics) {
          window.analytics.trackScrollZoom(wheelDirection > 0 ? 'in' : 'out', currentScale);
        }

        // Show zoom level indicator temporarily (for UX feedback)
        if (zoomHelp) {
          const originalText = zoomHelp.textContent;
          zoomHelp.textContent = `🖱️ Zoom: ${currentScale.toFixed(1)}x • Double-click to reset`;
          zoomHelp.style.opacity = '0.9';
          setTimeout(() => {
            zoomHelp.textContent = originalText;
            zoomHelp.style.opacity = '0.8';
          }, 1500);
        }
      }
    }

    // Double-click to reset to optimal view
    app.canvas.addEventListener('dblclick', resetToOptimalView);

    function resetToOptimalView() {
      const resetScale = Math.min(1, (canvasWidth - 200) / timelineWidth);
      currentScale = resetScale;
      timeline.scale.set(currentScale);

      // Re-center perfectly
      timeline.x = (canvasWidth - timelineWidth * currentScale) / 2;
      timeline.y = 0;

      // Track reset for analytics
      if (window.analytics) {
        window.analytics.trackZoomReset('double_click');
      }

      addDebug(`Double-click reset: Timeline reset to optimal view (${currentScale.toFixed(2)}x)`);
    }

    // Keyboard shortcuts for accessibility
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyR' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        resetToOptimalView();
      }
    });

    // Auto-hide zoom help with dismiss functionality (only rendered with chrome)
    const zoomHelp = document.getElementById('zoomHelp');
    const dismissHelp = document.getElementById('dismissHelp');
    let helpTimeout;
    let isHelpDismissed = localStorage.getItem('zoomHelpDismissed') === 'true';

    function showZoomHelp() {
      if (zoomHelp && !isHelpDismissed) {
        zoomHelp.style.opacity = '0.8';
        clearTimeout(helpTimeout);
        helpTimeout = setTimeout(() => {
          zoomHelp.style.opacity = '0.3';
        }, 3000);
      }
    }

    function hideZoomHelp() {
      if (zoomHelp && !isHelpDismissed) {
        clearTimeout(helpTimeout);
        helpTimeout = setTimeout(() => {
          zoomHelp.style.opacity = '0.1';
        }, 5000);
      }
    }

    function dismissZoomHelp() {
      if (zoomHelp) {
        zoomHelp.style.opacity = '0';
        setTimeout(() => {
          zoomHelp.style.display = 'none';
        }, 1000);
        localStorage.setItem('zoomHelpDismissed', 'true');
        isHelpDismissed = true;

        // Track dismissal for analytics
        if (window.analytics) {
          window.analytics.trackFeatureUsage('zoom_help_dismissed');
        }
      }
    }

    // Set up dismiss functionality
    if (zoomHelp && dismissHelp) {
      // Click anywhere on help to dismiss
      zoomHelp.addEventListener('click', dismissZoomHelp);

      // Hover effects for better UX
      zoomHelp.addEventListener('mouseenter', () => {
        if (!isHelpDismissed) {
          dismissHelp.style.opacity = '1';
          zoomHelp.style.opacity = '0.9';
        }
      });

      zoomHelp.addEventListener('mouseleave', () => {
        if (!isHelpDismissed) {
          dismissHelp.style.opacity = '0.6';
        }
      });
    }

    // Initialize help visibility based on dismissal state
    if (isHelpDismissed) {
      if (zoomHelp) {
        zoomHelp.style.display = 'none';
      }
    } else if (zoomHelp) {
      hideZoomHelp();

      // Show help when mouse enters canvas area
      app.canvas.addEventListener('mouseenter', showZoomHelp);
    }

    // Title display with configurable styling and navigation
    const titleText = new PIXI.Text({
      text: MEETING.title,
      style: {
        fontSize: MEETING.config.titleFontSize,
        fill: 0xFFFFFF,
        align: 'center',
        fontWeight: 'bold'
      }
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = canvasWidth / 2;
    titleText.y = 15;

    // Make title clickable for navigation back to meeting home
    titleText.eventMode = 'static';
    titleText.cursor = 'pointer';

    titleText.on('pointerover', () => {
      titleText.alpha = 0.7;
      titleText.style.fill = 0x0099CC; // Blue on hover to indicate clickability
    });

    titleText.on('pointerout', () => {
      titleText.alpha = 1;
      titleText.style.fill = 0xFFFFFF; // White normally
    });

    titleText.on('pointerdown', () => {
      if (window.analytics) {
        window.analytics.trackFeatureUsage('title_navigation_home');
      }
      window.location.href = '/meeting';
    });

    app.stage.addChild(titleText);

    // Mission status display (bottom right)
    const statusDisplay = new PIXI.Text({
      text: 'MISSION STATUS: STANDBY',
      style: {
        fontSize: 12,
        fill: 0x00FF00,
        align: 'right',
        fontFamily: 'monospace'
      }
    });
    statusDisplay.anchor.set(1, 1);
    statusDisplay.x = canvasWidth - 20;
    statusDisplay.y = canvasHeight - 20;
    app.stage.addChild(statusDisplay);

    // Current segment info display (top center)
    const currentSegmentDisplay = new PIXI.Text({
      text: '',
      style: {
        fontSize: 14,
        fill: 0xFFAA00,
        align: 'center',
        fontFamily: 'monospace'
      }
    });
    currentSegmentDisplay.anchor.set(0.5, 0);
    currentSegmentDisplay.x = canvasWidth / 2;
    currentSegmentDisplay.y = 50;
    app.stage.addChild(currentSegmentDisplay);

    // Compute the pixel position of the time marker from engine state,
    // interpolating across time gaps between segments (legacy buffer topics)
    function computeMarkerX(state) {
      if (state.phase === 'pre') return startX;
      if (state.phase === 'complete') return endX;

      let markerX = startX;
      for (let i = 0; i < segmentData.length; i++) {
        const layout = segmentData[i];
        const segState = state.segments[i];

        if (segState.status === 'upcoming') {
          // We're before this segment, position at the start of it
          markerX = layout.position;
          break;
        }
        if (segState.status === 'current') {
          // We're inside this segment, calculate position within it
          markerX = layout.position + (segState.progress * layout.width);
          break;
        }
        // completed
        if (i === segmentData.length - 1) {
          markerX = layout.position + layout.width;
        } else if (state.nowMs < state.segments[i + 1].startMs) {
          // We're in a time gap between this segment and the next
          const nextLayout = segmentData[i + 1];
          const gapStart = layout.position + layout.width;
          const gapEnd = nextLayout.position;
          const gapDuration = state.segments[i + 1].startMs - segState.endMs;
          const gapProgress = gapDuration > 0 ? (state.nowMs - segState.endMs) / gapDuration : 1;
          markerX = gapStart + (gapProgress * (gapEnd - gapStart));
          break;
        }
      }
      return markerX;
    }

    // Main animation loop driven by the shared time engine
    let currentSegmentIndex = -1;
    let lastUpdateTime = 0;

    engine.onFrame((state) => {
      currentTimeMarker.x = computeMarkerX(state);

      if (state.phase === 'pre') {
        const humanized = moment.duration(state.msUntilStart).humanize();
        timeDisplay.text = `T-${humanized}`;
        statusDisplay.text = 'MISSION STATUS: PRE-FLIGHT';
        statusDisplay.style.fill = 0x0099CC;
        currentSegmentDisplay.text = `LAUNCHING IN ${humanized.toUpperCase()}`;
      } else if (state.phase === 'complete') {
        timeDisplay.text = 'MISSION COMPLETE';
        statusDisplay.text = 'MISSION STATUS: COMPLETE';
        statusDisplay.style.fill = 0x00FF00;
        currentSegmentDisplay.text = 'ALL OBJECTIVES ACHIEVED';
      } else {
        timeDisplay.text = moment(state.nowMs).format('HH:mm:ss');
        statusDisplay.text = 'MISSION STATUS: ACTIVE';
        statusDisplay.style.fill = 0xFFAA00;
      }

      // Animate marker with configurable pulsing
      if (markerCircle) {
        markerCircle.alpha = 0.8 + Math.sin(Date.now() / markerConfig.pulseSpeed) * 0.2;
      }

      // Animate glow effect if enabled
      if (glowEffect) {
        glowEffect.alpha = markerConfig.glowIntensity + Math.sin(Date.now() / (markerConfig.pulseSpeed * 1.5)) * (markerConfig.glowIntensity * 0.5);
      }

      // Update segment states (throttled to once per second)
      if (Date.now() - lastUpdateTime > 1000) {
        lastUpdateTime = Date.now();

        let newCurrentSegmentIndex = -1;

        state.segments.forEach((segState, index) => {
          if (segState.status === 'current') {
            newCurrentSegmentIndex = index;
          }

          const layout = segmentData[index];
          const segment = segments[index];
          const glow = segmentGlows[index];
          const label = labels[index];
          const timeLabel = timeLabels[index];
          const statusIcon = layout.statusIcon;

          const segmentHeight = MEETING.config.segmentHeight;
          const halfHeight = segmentHeight / 2;

          if (segState.status === 'completed') {
            // Completed state - dark gray with checkmark
            segment.clear();
            segment.roundRect(0, -halfHeight, layout.width, segmentHeight, 8);
            segment.fill({ color: colors.completed, alpha: colors.completedAlpha });
            segment.stroke({ width: 2, color: 0x00FF00, alpha: 0.5 }); // Green border for completed

            glow.alpha = 0; // No glow for completed
            label.style.fill = 0xAAAAAA; // Muted text
            if (timeLabel) timeLabel.style.fill = 0x00AA00; // Dim green
            if (statusIcon) {
              statusIcon.text = '✓';
              statusIcon.style.fill = 0x00FF00;
            }

            // Remove progress bar left over from when this segment was current
            if (layout.progressBar) {
              timeline.removeChild(layout.progressBar);
              layout.progressBar = null;
            }

          } else if (segState.status === 'current') {
            // Current state - bright amber with pulsing glow
            segment.clear();
            segment.roundRect(0, -halfHeight, layout.width, segmentHeight, 8);
            segment.fill({ color: colors.current, alpha: colors.currentAlpha });
            segment.stroke({ width: 3, color: 0xFFAA00, alpha: 0.8 }); // Bright orange border

            // Pulsing glow effect
            glow.alpha = 0.2 + Math.sin(Date.now() / (400 / MEETING.config.animationSpeed)) * 0.15;

            label.style.fill = 0xFFFFFF; // Bright white text
            if (timeLabel) timeLabel.style.fill = 0xFFAA00; // Bright orange
            if (statusIcon) {
              statusIcon.text = '▶';
              statusIcon.style.fill = 0xFFAA00;
            }

            // Progress bar (configurable)
            if (MEETING.config.showProgressBars) {
              const progressBar = new PIXI.Graphics();
              progressBar.rect(0, halfHeight - 2, layout.width * segState.progress, 2);
              progressBar.fill({ color: 0xFFAA00, alpha: 0.8 });
              progressBar.x = layout.position;
              progressBar.y = yPosition;

              // Remove old progress bar if exists
              if (layout.progressBar) {
                timeline.removeChild(layout.progressBar);
              }
              timeline.addChild(progressBar);
              layout.progressBar = progressBar;
            }

            // Update current segment display
            currentSegmentDisplay.text = `CURRENT: ${(segState.person || '').toUpperCase()} | ${MeetingTimeEngine.formatMMSS(segState.msRemaining)} REMAINING`;

          } else {
            // Upcoming state - cool blue
            segment.clear();
            segment.roundRect(0, -halfHeight, layout.width, segmentHeight, 8);
            segment.fill({ color: colors.upcoming, alpha: colors.upcomingAlpha });
            segment.stroke({ width: 2, color: 0x0099CC, alpha: 0.6 });

            glow.alpha = 0; // No glow for upcoming
            label.style.fill = 0xCCCCCC; // Slightly muted text
            if (timeLabel) timeLabel.style.fill = 0x0099CC; // Blue
            if (statusIcon) {
              statusIcon.text = '○';
              statusIcon.style.fill = 0x0099CC;
            }

            // Remove progress bar if segment is no longer current
            if (layout.progressBar) {
              timeline.removeChild(layout.progressBar);
              layout.progressBar = null;
            }
          }
        });

        // Update current segment tracking
        if (newCurrentSegmentIndex !== currentSegmentIndex) {
          currentSegmentIndex = newCurrentSegmentIndex;
          if (currentSegmentIndex >= 0) {
            const currentSeg = segmentData[currentSegmentIndex];
            addDebug(`🎯 ACTIVE: ${currentSeg.topic.person} - ${currentSeg.topic.topic}`);
          } else if (state.phase === 'complete') {
            currentSegmentDisplay.text = 'MISSION ACCOMPLISHED';
          } else if (state.phase === 'active') {
            currentSegmentDisplay.text = 'MISSION STANDBY';
          }
        }
      }
    });

  })().catch(console.error);

  // Analytics tracking for meeting view and timeline interactions.
  // Muted entirely in editor preview iframes so previews don't pollute stats.
  if (!MEETING.preview) {
    (function () {
      // Track meeting viewed
      if (window.analytics) {
        const meetingViewData = {
          id: MEETING.id,
          topics: MEETING.topics,
          duration: totalDurationMinutes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          background: MEETING.background
        };

        window.analytics.trackMeetingViewed(meetingViewData);
        window.analytics.trackMeetingPurposePattern(MEETING.topics);
      }

      let timelineStarted = false;

      const trackTimelineStart = () => {
        if (!timelineStarted && window.analytics) {
          timelineStarted = true;
          window.analytics.trackTimelineStarted();
        }
      };

      // Track keyboard shortcuts
      document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyR' && !event.ctrlKey && !event.metaKey && window.analytics) {
          window.analytics.trackKeyboardShortcut('reset_view');
          trackTimelineStart();
        }
      });

      // Track timeline completion when meeting ends
      const checkTimelineCompletion = () => {
        if (engine.getState().phase === 'complete' && timelineStarted && window.analytics) {
          window.analytics.trackTimelineCompleted(totalDurationMinutes);
          clearInterval(completionCheckInterval); // Stop checking
        }
      };

      // Check for completion every 30 seconds
      const completionCheckInterval = setInterval(checkTimelineCompletion, 30000);

      // Check for any stored meeting creation data from form submission
      if (sessionStorage.getItem('newMeetingData') && window.analytics) {
        try {
          const newMeetingData = JSON.parse(sessionStorage.getItem('newMeetingData'));
          window.analytics.trackMeetingCreated(newMeetingData);
          sessionStorage.removeItem('newMeetingData'); // Clean up
        } catch (e) {
          console.warn('Could not parse stored meeting data:', e);
        }
      }

      // Track performance metrics
      if (window.analytics && window.performance) {
        window.addEventListener('load', () => {
          setTimeout(() => {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            window.analytics.trackPerformance('page_load_time', loadTime);
          }, 0);
        });

        const pixiInitTime = performance.now();
        setTimeout(() => {
          const pixiLoadTime = performance.now() - pixiInitTime;
          if (window.analytics) {
            window.analytics.trackPerformance('pixi_init_time', pixiLoadTime);
          }
        }, 1000);
      }

      // Track any errors
      window.addEventListener('error', (e) => {
        if (window.analytics) {
          window.analytics.trackError('javascript_error', e.message, {
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno
          });
        }
      });
    })();
  }
})();
