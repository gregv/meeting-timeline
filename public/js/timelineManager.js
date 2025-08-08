// TimelineManager.js

// Note: For browser compatibility, these imports need to be handled differently
// The browser version should use global PIXI, moment, and timelineUtils

class TimelineManager {
    constructor(countdowns, canvasWidth, canvasHeight) {
        this.countdowns = countdowns;
        this.app = new PIXI.Application({
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: 0x000000,
            resolution: window.devicePixelRatio || 1,
        });

        this.activeTimeline = new PIXI.Container();
        this.completedTimeline = new PIXI.Container();
        this.app.stage.addChild(this.activeTimeline);
        this.app.stage.addChild(this.completedTimeline);

        this.nodeRadius = 10;
        this.lineHeight = 2;
        this.activeYPosition = this.app.screen.height / 3;
        this.completedYPosition = this.app.screen.height * 2 / 3;
        this.startX = 50;
        this.endX = this.app.screen.width - 50;
        this.timelineWidth = this.endX - this.startX;

        this.startTime = moment().startOf('day');
        this.endTime = moment(this.countdowns[this.countdowns.length - 1].time);
        this.totalDuration = this.endTime.diff(this.startTime);

        this.nodes = [];
        this.tooltips = [];
        this.labels = [];

        this.currentScale = 1;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };

        this.init();
    }

    init() {
        timelineUtils.drawBaseTimelines(
            PIXI, 
            this.activeTimeline, 
            this.completedTimeline, 
            this.startX, 
            this.endX, 
            this.activeYPosition, 
            this.completedYPosition, 
            this.lineHeight
        );

        this.createEventElements();
        this.createCurrentTimeMarker();
        this.setupInteractivity();
        this.startAnimation();
    }

    createEventElements() {
        this.countdowns.forEach((item, index) => {
            const x = this.startX + (moment(item.time).diff(this.startTime) / this.totalDuration) * this.timelineWidth;
            const elements = timelineUtils.createEventElements(item, this.activeYPosition, PIXI, this.nodeRadius);
            elements.node.x = x;
            elements.label.x = x;
            elements.tooltip.x = x;

            this.activeTimeline.addChild(elements.node, elements.label, elements.tooltip);
            this.nodes.push(elements.node);
            this.labels.push(elements.label);
            this.tooltips.push(elements.tooltip);
        });

        timelineUtils.adjustOverlap(this.nodes, this.startX, this.endX);

        this.nodes.forEach((node, index) => {
            this.labels[index].x = node.x;
            this.tooltips[index].x = node.x;
        });
    }

    createCurrentTimeMarker() {
        this.currentTimeMarker = new PIXI.Container();
        const markerCircle = new PIXI.Graphics();
        markerCircle.beginFill(0xFF0000);
        markerCircle.drawCircle(0, 0, this.nodeRadius * 1.5);
        markerCircle.endFill();
        this.currentTimeMarker.addChild(markerCircle);

        this.glowSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        this.glowSprite.width = this.glowSprite.height = this.nodeRadius * 6;
        this.glowSprite.anchor.set(0.5);
        this.glowSprite.tint = 0xFF0000;
        this.glowSprite.alpha = 0.5;
        this.currentTimeMarker.addChild(this.glowSprite);

        this.timeDisplay = new PIXI.Text('', {
            fontSize: 16,
            fill: 0xFFFFFF,
        });
        this.timeDisplay.anchor.set(0.5, 1);
        this.timeDisplay.y = -20;
        this.currentTimeMarker.addChild(this.timeDisplay);

        this.currentTimeMarker.y = this.activeYPosition;
        this.activeTimeline.addChild(this.currentTimeMarker);
    }

    setupInteractivity() {
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;
        this.app.stage.on('pointerdown', this.onDragStart.bind(this))
            .on('pointerup', this.onDragEnd.bind(this))
            .on('pointerupoutside', this.onDragEnd.bind(this))
            .on('pointermove', this.onDragMove.bind(this));
    }

    onDragStart(event) {
        this.isDragging = true;
        this.dragStart = { 
            x: event.data.global.x - this.activeTimeline.x, 
            y: event.data.global.y - this.activeTimeline.y 
        };
    }

    onDragEnd() {
        this.isDragging = false;
    }

    onDragMove(event) {
        if (this.isDragging) {
            const newPosition = event.data.global;
            this.activeTimeline.x = newPosition.x - this.dragStart.x;
            this.activeTimeline.y = newPosition.y - this.dragStart.y;
            this.completedTimeline.x = this.activeTimeline.x;
            this.completedTimeline.y = this.activeTimeline.y;
        }
    }

    zoom(scale) {
        if (scale > 0.1 && scale < 3) {
            this.currentScale = scale;
            this.activeTimeline.scale.set(this.currentScale);
            this.completedTimeline.scale.set(this.currentScale);

            // Center the timeline
            this.activeTimeline.x = (this.app.screen.width - this.timelineWidth * this.currentScale) / 2;
            this.activeTimeline.y = 0;
            this.completedTimeline.x = this.activeTimeline.x;
            this.completedTimeline.y = this.activeTimeline.y;
        }
    }

    startAnimation() {
        this.app.ticker.add(() => {
            const now = moment();
            timelineUtils.updateZoom(now, this.countdowns, this.zoom.bind(this));

            if (now < this.startTime) {
                this.currentTimeMarker.x = this.startX;
                this.timeDisplay.text = `Time to start: ${moment.duration(this.startTime.diff(now)).humanize()}`;
            } else if (now > this.endTime) {
                this.currentTimeMarker.x = this.endX;
                this.timeDisplay.text = 'Event completed';
            } else {
                const progress = now.diff(this.startTime) / this.totalDuration;
                this.currentTimeMarker.x = this.startX + progress * this.timelineWidth;
                this.timeDisplay.text = now.format('YYYY-MM-DD HH:mm:ss');
            }

            // Animate glow
            this.glowSprite.alpha = 0.3 + Math.sin(Date.now() / 300) * 0.2;

            // Move completed events to the bottom timeline
            this.nodes.forEach((node, index) => {
                const itemTime = moment(this.countdowns[index].time);
                if (now > itemTime && node.parent === this.activeTimeline) {
                    this.activeTimeline.removeChild(node);
                    this.activeTimeline.removeChild(this.labels[index]);
                    this.activeTimeline.removeChild(this.tooltips[index]);

                    node.y = this.completedYPosition;
                    this.labels[index].y = this.completedYPosition + 30;
                    this.tooltips[index].y = this.completedYPosition - 20;

                    this.completedTimeline.addChild(node, this.labels[index], this.tooltips[index]);
                }
            });
        });
    }

    get view() {
        return this.app.view;
    }

    zoomIn() {
        this.zoom(this.currentScale * 1.2);
    }

    zoomOut() {
        this.zoom(this.currentScale / 1.2);
    }

    resetZoom() {
        this.zoom(1);
    }
}

// Export for browser use
if (typeof window !== 'undefined') {
    window.TimelineManager = TimelineManager;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimelineManager;
}