// timelineUtils.js

const timelineUtils = {
    adjustOverlap: function(items, startX, endX) {
        const minSpace = 100; // Minimum space between items
        let prevX = -Infinity;
        
        items.forEach((item) => {
            if (item.x - prevX < minSpace) {
                item.x = prevX + minSpace;
            }
            prevX = item.x;
            
            // Ensure the item is within the timeline bounds
            item.x = Math.max(startX, Math.min(item.x, endX));
        });
    },

    createEventElements: function(item, yPos, PIXI, nodeRadius) {
        // Fix: Use window.moment instead of importing
        const itemTime = window.moment ? window.moment(item.time) : new Date(item.time);

        // Create node
        const node = new PIXI.Graphics();
        node.beginFill(0xFFFFFF);
        node.drawCircle(0, 0, nodeRadius);
        node.endFill();
        node.y = yPos;

        // Create label
        const label = new PIXI.Text(item.name, {
            fontSize: 12,
            fill: 0xFFFFFF,
            align: 'center',
        });
        label.anchor.set(0.5);
        label.y = yPos + 30;
        label.angle = 45;

        // Create tooltip
        const timeStr = window.moment ? itemTime.format('YYYY-MM-DD HH:mm:ss') : itemTime.toLocaleString();
        const tooltip = new PIXI.Text(`${item.description}\nTime: ${timeStr}`, {
            fontSize: 14,
            fill: 0xFFFFFF,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: 200,
        });
        tooltip.anchor.set(0.5, 1);
        tooltip.y = yPos - 20;
        tooltip.visible = false;

        // Add interactivity
        node.eventMode = 'static';
        node.cursor = 'pointer';
        node.on('mouseover', () => {
            tooltip.visible = true;
        });
        node.on('mouseout', () => {
            tooltip.visible = false;
        });

        return { node, label, tooltip };
    },

    findClosestUpcomingEvent: function(now, countdowns) {
        let closestEvent = null;
        let closestDiff = Infinity;

        countdowns.forEach((event) => {
            const eventTime = window.moment ? window.moment(event.time) : new Date(event.time);
            const eventTimestamp = window.moment ? eventTime.valueOf() : eventTime.getTime();
            const nowTimestamp = window.moment ? now.valueOf() : now.getTime();
            
            if (eventTimestamp > nowTimestamp) {
                const diff = eventTimestamp - nowTimestamp;
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestEvent = event;
                }
            }
        });

        return closestEvent;
    },

    updateZoom: function(now, countdowns, zoomCallback) {
        const closestEvent = this.findClosestUpcomingEvent(now, countdowns);
        if (closestEvent) {
            const eventTime = window.moment ? window.moment(closestEvent.time) : new Date(closestEvent.time);
            let timeUntilEvent;
            
            if (window.moment) {
                timeUntilEvent = eventTime.diff(now, 'days');
            } else {
                timeUntilEvent = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            }
            
            if (timeUntilEvent <= 1) {
                zoomCallback(3); // Max zoom when event is within 1 day
            } else if (timeUntilEvent <= 14) {
                zoomCallback(2); // Medium zoom when event is within 2 weeks
            } else if (timeUntilEvent <= 30) {
                zoomCallback(1); // Default zoom when event is within 1 month
            } else {
                zoomCallback(0.5); // Zoomed out when event is more than 1 month away
            }
        } else {
            zoomCallback(1); // Default zoom if no upcoming events
        }
    },

    drawBaseTimelines: function(PIXI, activeTimeline, completedTimeline, startX, endX, activeYPosition, completedYPosition, lineHeight) {
        const activeBaseline = new PIXI.Graphics();
        activeBaseline.lineStyle(lineHeight, 0x333333);
        activeBaseline.moveTo(startX, activeYPosition);
        activeBaseline.lineTo(endX, activeYPosition);
        activeTimeline.addChild(activeBaseline);

        const completedBaseline = new PIXI.Graphics();
        completedBaseline.lineStyle(lineHeight, 0x333333);
        completedBaseline.moveTo(startX, completedYPosition);
        completedBaseline.lineTo(endX, completedYPosition);
        completedTimeline.addChild(completedBaseline);
    }
};

// Browser compatibility
if (typeof window !== 'undefined') {
    window.timelineUtils = timelineUtils;
}

// Module compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = timelineUtils;
}