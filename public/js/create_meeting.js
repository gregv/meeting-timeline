// https://stackoverflow.com/questions/11871253/execute-document-ready-even-if-user-came-to-the-page-by-hitting-the-back-button
$(window).on('pageshow', function(){
  // We want to set the current timezone of the user because likely they will want to set the meeting time in their timezone
  $("#timezone").val(moment.tz.guess());
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
      );
    });

    $("#num_meetings").text(meeting_counter);
    $("#num_minutes").text(total_duration);
    $("#num_topics").text(total_topics);

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
