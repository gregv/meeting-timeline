// https://stackoverflow.com/questions/11871253/execute-document-ready-even-if-user-came-to-the-page-by-hitting-the-back-button
$(window).on('pageshow', function(){
  // We want to set the current timezone of the user because likely they will want to set the meeting time in their timezone
  $("#timezone").val(moment.tz.guess());
  
  // Track timezone preference when automatically set
  if (window.analytics) {
    window.analytics.trackTimezonePrefernce(moment.tz.guess());
  }
});

// Track form interactions and submit events
$(document).ready(function() {
  // Track when user starts interacting with the form
  let formStarted = false;
  $('form input, form select, form textarea').one('focus', function() {
    if (!formStarted && window.analytics) {
      formStarted = true;
      window.analytics.trackFormStart('create_meeting');
    }
  });
  
  // Track individual field interactions (throttled)
  $('form input, form select, form textarea').on('focus', function() {
    if (window.analytics) {
      const fieldName = $(this).attr('name') || $(this).attr('id') || 'unknown_field';
      window.analytics.trackFormFieldInteraction('create_meeting', fieldName);
    }
  });
  
  // Track timezone changes
  $('#timezone').on('change', function() {
    if (window.analytics) {
      window.analytics.trackTimezonePrefernce($(this).val());
    }
  });
  
  // Track form validation errors
  $('form').on('submit', function(e) {
    // Check for validation errors
    const invalidFields = $(this).find(':invalid');
    if (invalidFields.length > 0 && window.analytics) {
      invalidFields.each(function() {
        const fieldName = $(this).attr('name') || $(this).attr('id') || 'unknown_field';
        const errorMessage = this.validationMessage || 'validation_error';
        window.analytics.trackFormValidationError('create_meeting', fieldName, errorMessage);
      });
      return; // Don't track successful submit if there are errors
    }
    
    // Track successful form submission
    if (window.analytics) {
      const formData = {
        topics_count: $('.topic-row').length,
        timezone: $('#timezone').val(),
        has_custom_background: $('#background').val() !== '#0047BB',
        meeting_title: $('#title').val() ? 'provided' : 'empty'
      };
      window.analytics.trackFormSubmitted('create_meeting', formData);
      
      // Track meeting creation (will be completed after redirect)
      const meetingData = {
        id: window.location.pathname.split('/').pop(), // Extract meeting ID from URL
        topics: $('.topic-row').map(function() {
          return {
            title: $(this).find('[name="topic[]"]').val(),
            duration: $(this).find('[name="duration[]"]').val()
          };
        }).get(),
        timezone: $('#timezone').val(),
        background: $('#background').val()
      };
      
      // Store meeting data for tracking after redirect
      sessionStorage.setItem('newMeetingData', JSON.stringify(meetingData));
    }
  });
});

const handleResponse = (function(response, statusCode, xmlhtpo){
    // https://stackoverflow.com/questions/60459321/load-list-objects-in-ajax-response-and-create-dynmic-list-divs-with-this-data
    var meetingListTemplate = $("#meetingListTemplate").html();

    var total_duration = 0;
    var total_topics = 0;
    var meeting_counter = 0;

    $("#meeting_list").html("");

    response.forEach((item, i) => {
      meeting_counter++;
      total_duration += item.duration;
      total_topics += item.num_topics;

      add_s = "";
      if( item.num_topics > 1 )
      {
        add_s = "s";
      }

      const publicBadge = item.is_public ? '<span class="badge bg-success ms-2">🌐 Public</span>' : '';

      $("#meeting_list").append(
        meetingListTemplate.replace("{title}",item.title)
        .replace("{id}",item.meeting_id)
        .replace("{id}",item.meeting_id)
        .replace("{id}",item.meeting_id)
        .replace("{id}",item.meeting_id)
        .replace("{duration}",item.duration)
        .replace("{num_topics}",item.num_topics)
        .replace("{start_time}", moment(item.start).format("hh:mm A") )
        .replace("{s}",add_s)
        .replace("{public_badge}",publicBadge)
      );
    });

    $("#num_meetings").text(meeting_counter);
    $("#num_minutes").text(total_duration);
    $("#num_topics").text(total_topics);
    
    // Track meeting list viewed
    if (window.analytics && response.length > 0) {
      window.analytics.trackFeatureUsage('meeting_list_viewed', {
        meetings_count: meeting_counter,
        total_duration: total_duration,
        total_topics: total_topics
      });
    }

});

// Track meeting list interactions
$(document).ready(function() {
  // Track when user clicks on a meeting in the list
  $(document).on('click', '.meeting-item a, [href*="/meeting/"]', function() {
    if (window.analytics) {
      const href = $(this).attr('href');
      const meetingId = href ? href.split('/').pop() : 'unknown';
      window.analytics.trackFeatureUsage('meeting_list_click', {
        meeting_id: meetingId,
        click_type: 'view_meeting'
      });
    }
  });
  
  // Track edit button clicks
  $(document).on('click', '[href*="/edit"]', function() {
    if (window.analytics) {
      const href = $(this).attr('href');
      const meetingId = href ? href.split('/')[1] : 'unknown';
      window.analytics.trackFeatureUsage('meeting_list_click', {
        meeting_id: meetingId,
        click_type: 'edit_meeting'
      });
    }
  });
});

const appUrl = window.location.href.split('?')[0];
// https://github.com/robertbunch/justExpress/blob/c75addcfd2a356a1b52ffe68113f8277ac5ea1a8/express201/public/ajax.html
 setInterval(
   function() {
     $.ajax({
         method: "GET",
         url: appUrl+"/list",
         timeout: 2500,
         success: handleResponse
     })},5000);

$.ajax({
 method: "GET",
 url: appUrl+"/list",
 timeout: 1000,
 success: handleResponse
});
