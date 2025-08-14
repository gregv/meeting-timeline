// Google Analytics Event Tracking Utility for Meeting Timeline Application

class AnalyticsTracker {
    constructor() {
        this.isGtagLoaded = typeof gtag !== 'undefined';
        this.sessionStartTime = Date.now();
        this.currentMeetingId = null;
        this.timelineInteractions = 0;
        
        if (!this.isGtagLoaded) {
            console.warn('gtag not loaded - analytics tracking disabled');
        }
        
        this.init();
    }

    init() {
        // Track session start
        this.trackEvent('session', 'start', 'user_session');
        
        // Track page type
        this.identifyPageType();
        
        // Set up unload tracking
        window.addEventListener('beforeunload', () => {
            this.trackSessionEnd();
        });
    }

    identifyPageType() {
        const path = window.location.pathname;
        let pageType = 'unknown';
        
        if (path === '/' || path === '/meeting/') {
            pageType = 'home';
        } else if (path.includes('/meeting/create')) {
            pageType = 'create';
        } else if (path.includes('/meeting/') && path.includes('/edit')) {
            pageType = 'edit';
        } else if (path.includes('/meeting/')) {
            pageType = 'timeline';
            // Extract meeting ID from URL
            const matches = path.match(/\/meeting\/([^\/]+)$/);
            if (matches) {
                this.currentMeetingId = matches[1];
            }
        }
        
        this.trackEvent('page', 'view', pageType, {
            page_type: pageType,
            meeting_id: this.currentMeetingId
        });
    }

    // Core tracking method
    trackEvent(category, action, label, customParameters = {}) {
        if (!this.isGtagLoaded) return;
        
        const eventData = {
            event_category: category,
            event_label: label,
            ...customParameters
        };
        
        gtag('event', action, eventData);
        console.log('Analytics Event:', category, action, label, eventData);
    }

    // Meeting lifecycle events
    trackMeetingCreated(meetingData) {
        this.trackEvent('meeting', 'created', 'meeting_lifecycle', {
            meeting_id: meetingData.id || 'unknown',
            topics_count: meetingData.topics ? meetingData.topics.length : 0,
            duration_minutes: meetingData.duration || 0,
            timezone: meetingData.timezone || 'unknown',
            has_custom_background: meetingData.background !== '0047BB'
        });
    }

    trackMeetingViewed(meetingData) {
        this.currentMeetingId = meetingData.id;
        this.trackEvent('meeting', 'viewed', 'meeting_lifecycle', {
            meeting_id: meetingData.id || 'unknown',
            topics_count: meetingData.topics ? meetingData.topics.length : 0,
            duration_minutes: meetingData.duration || 0
        });
    }

    trackMeetingEdited(meetingId) {
        this.trackEvent('meeting', 'edited', 'meeting_lifecycle', {
            meeting_id: meetingId
        });
    }

    trackMeetingDeleted(meetingId) {
        this.trackEvent('meeting', 'deleted', 'meeting_lifecycle', {
            meeting_id: meetingId
        });
    }

    // Timeline interaction events
    trackTimelineStarted() {
        this.trackEvent('timeline', 'started', 'timeline_control', {
            meeting_id: this.currentMeetingId
        });
    }

    trackTimelinePaused() {
        this.trackEvent('timeline', 'paused', 'timeline_control', {
            meeting_id: this.currentMeetingId
        });
    }

    trackTimelineReset() {
        this.trackEvent('timeline', 'reset', 'timeline_control', {
            meeting_id: this.currentMeetingId
        });
    }

    trackTimelineCompleted(durationMinutes) {
        this.trackEvent('timeline', 'completed', 'timeline_control', {
            meeting_id: this.currentMeetingId,
            duration_minutes: durationMinutes
        });
    }

    // Modern Timeline zoom and navigation with scroll-based interactions
    trackScrollZoom(direction, currentScale) {
        this.timelineInteractions++;
        this.trackEvent('timeline', 'scroll_zoom', 'timeline_navigation', {
            meeting_id: this.currentMeetingId,
            zoom_direction: direction, // 'in' or 'out'
            current_scale: currentScale.toFixed(2),
            interaction_count: this.timelineInteractions
        });
    }

    trackZoomReset(method) {
        this.timelineInteractions++;
        this.trackEvent('timeline', 'zoom_reset', 'timeline_navigation', {
            meeting_id: this.currentMeetingId,
            reset_method: method, // 'double_click', 'keyboard', etc.
            interaction_count: this.timelineInteractions
        });
    }

    trackKeyboardShortcut(shortcut) {
        this.timelineInteractions++;
        this.trackEvent('timeline', 'keyboard_shortcut', 'timeline_navigation', {
            meeting_id: this.currentMeetingId,
            shortcut: shortcut,
            interaction_count: this.timelineInteractions
        });
    }

    // Legacy zoom methods (kept for backwards compatibility)
    trackZoomIn() {
        this.trackScrollZoom('in', 1);
    }

    trackZoomOut() {
        this.trackScrollZoom('out', 1);
    }

    trackResetView() {
        this.trackZoomReset('button');
    }

    trackTimelineDrag() {
        this.timelineInteractions++;
        // Throttle drag events to avoid spam
        if (this.timelineInteractions % 5 === 0) {
            this.trackEvent('timeline', 'dragged', 'timeline_navigation', {
                meeting_id: this.currentMeetingId,
                interaction_count: this.timelineInteractions
            });
        }
    }

    // Form interaction events
    trackFormStart(formType) {
        this.trackEvent('form', 'started', formType, {
            form_type: formType
        });
    }

    trackFormSubmitted(formType, formData = {}) {
        this.trackEvent('form', 'submitted', formType, {
            form_type: formType,
            ...formData
        });
    }

    trackFormValidationError(formType, errorField, errorMessage) {
        this.trackEvent('form', 'validation_error', formType, {
            form_type: formType,
            error_field: errorField,
            error_message: errorMessage
        });
    }

    trackFormFieldInteraction(formType, fieldName) {
        // Throttled to avoid spam
        if (!this.fieldInteractions) this.fieldInteractions = {};
        if (!this.fieldInteractions[fieldName]) {
            this.fieldInteractions[fieldName] = true;
            this.trackEvent('form', 'field_interaction', formType, {
                form_type: formType,
                field_name: fieldName
            });
        }
    }

    // User engagement metrics
    trackTimeSpentOnPage() {
        const timeSpent = Math.round((Date.now() - this.sessionStartTime) / 1000);
        
        // Track engagement milestones
        if (timeSpent === 30 || timeSpent === 60 || timeSpent === 300 || timeSpent === 600) {
            this.trackEvent('engagement', 'time_milestone', 'user_engagement', {
                seconds_spent: timeSpent,
                meeting_id: this.currentMeetingId
            });
        }
    }

    trackError(errorType, errorMessage, context = {}) {
        this.trackEvent('error', errorType, 'application_error', {
            error_message: errorMessage,
            error_context: JSON.stringify(context),
            meeting_id: this.currentMeetingId
        });
    }

    trackFeatureUsage(featureName, featureData = {}) {
        this.trackEvent('feature', 'used', featureName, {
            feature_name: featureName,
            ...featureData,
            meeting_id: this.currentMeetingId
        });
    }

    // Performance tracking
    trackPerformance(metric, value) {
        this.trackEvent('performance', metric, 'app_performance', {
            metric_name: metric,
            metric_value: value,
            meeting_id: this.currentMeetingId
        });
    }

    // Session management
    trackSessionEnd() {
        const sessionDuration = Math.round((Date.now() - this.sessionStartTime) / 1000);
        this.trackEvent('session', 'end', 'user_session', {
            session_duration_seconds: sessionDuration,
            timeline_interactions: this.timelineInteractions,
            meeting_id: this.currentMeetingId
        });
    }

    // Advanced event tracking for business insights
    trackMeetingPurposePattern(topics) {
        if (!topics || !topics.length) return;
        
        // Analyze meeting patterns
        const avgDuration = topics.reduce((acc, topic) => acc + (topic.duration || 0), 0) / topics.length;
        const hasBreaks = topics.some(topic => topic.title && topic.title.toLowerCase().includes('break'));
        const hasIntros = topics.some(topic => topic.title && topic.title.toLowerCase().includes('intro'));
        
        this.trackEvent('meeting', 'pattern_analysis', 'meeting_insights', {
            meeting_id: this.currentMeetingId,
            topics_count: topics.length,
            avg_topic_duration: Math.round(avgDuration),
            has_breaks: hasBreaks,
            has_introductions: hasIntros
        });
    }

    trackTimezonePrefernce(timezone) {
        this.trackEvent('user', 'timezone_preference', 'user_behavior', {
            timezone: timezone,
            timezone_region: this.extractTimezoneRegion(timezone)
        });
    }

    extractTimezoneRegion(timezone) {
        if (!timezone) return 'unknown';
        const parts = timezone.split('/');
        return parts[0] || 'unknown';
    }
}

// Initialize analytics tracker when DOM is ready
let analytics;

// Initialize when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    analytics = new AnalyticsTracker();
    
    // Set up automatic time tracking
    setInterval(() => {
        analytics.trackTimeSpentOnPage();
    }, 30000); // Every 30 seconds
});

// Make analytics available globally
if (typeof window !== 'undefined') {
    window.analytics = analytics;
    window.AnalyticsTracker = AnalyticsTracker;
}