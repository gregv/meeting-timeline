const path = require('path');
const fs = require('fs');
const express = require('express');
const router = express.Router();
const date = require('date-and-time');

const redis = require("redis");
const momentTZ = require('moment-timezone');
const sha3 = require("crypto-js/sha3");


// --- Redis connection setup (fixed) ---
let redisSource = process.env.REDIS_URL || process.env.REDIS_HOST || "127.0.0.1";
let client;

if (redisSource.startsWith("redis://") || redisSource.startsWith("rediss://")) {
  // Full URL with credentials
  client = redis.createClient({ url: redisSource });
  console.log("Using Redis URL:", redisSource);
} else {
  // Just a hostname
  client = redis.createClient({ host: redisSource });
}

function maskRedis(ref) {
  try {
    const u = new URL(ref);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return ref;
  }
}

client.on('error', (err) => {
  console.error("Redis connection error:", err.message);
});

// Log (sanitized) connection target once
console.log("Connecting to Redis:", maskRedis(redisSource));

function parseDuration(durationString)
{
  let result = 0;

  if( Number.isInteger(parseInt(durationString))  )
  {
    result = parseInt(durationString);
  }
  else {
    result = 0;
  }

  return result;
}

function getDataFromRedis(redis_meeting)
{
  console.log("=== Data from Redis ===");
  console.log(redis_meeting);
  console.log("=======================\n");

  // Let's start with some easy - the background color - if it's not set, we default to blue since
  // this blue is used by OBS for the Chroma Key to overlay the timeline easily over you from your browser
  let background = "0047BB";
  if( redis_meeting.background != null )
  {
    background = redis_meeting.background.replace("#","");
  }

  let icon = "cat.png";
  if( redis_meeting.icon != null )
  {
    icon = redis_meeting.icon;
  }

  // Configuration options with defaults
  const config = {
    titleFontSize: parseInt(redis_meeting.titleFontSize) || 24,
    blockFontSize: parseInt(redis_meeting.blockFontSize) || 11,
    timeLabelFontSize: parseInt(redis_meeting.timeLabelFontSize) || 10,
    showDebug: redis_meeting.showDebug === 'on' || redis_meeting.showDebug === true,
    showProgressBars: redis_meeting.showProgressBars === 'on' || redis_meeting.showProgressBars === true || redis_meeting.showProgressBars === undefined,
    showStatusIcons: redis_meeting.showStatusIcons === 'on' || redis_meeting.showStatusIcons === true || redis_meeting.showStatusIcons === undefined,
    showTimeLabels: redis_meeting.showTimeLabels === 'on' || redis_meeting.showTimeLabels === true || redis_meeting.showTimeLabels === undefined,
    animationSpeed: parseFloat(redis_meeting.animationSpeed) || 1.0,
    segmentHeight: parseInt(redis_meeting.segmentHeight) || 50,
    colors: {
      completed: redis_meeting.completedColor || "404040",
      current: redis_meeting.currentColor || "FF6600", 
      upcoming: redis_meeting.upcomingColor || "0099CC",
      completedAlpha: parseFloat(redis_meeting.completedAlpha) || 0.6,
      currentAlpha: parseFloat(redis_meeting.currentAlpha) || 0.9,
      upcomingAlpha: parseFloat(redis_meeting.upcomingAlpha) || 0.4
    },
    missionControlTheme: redis_meeting.missionControlTheme === 'on' || redis_meeting.missionControlTheme === true || redis_meeting.missionControlTheme === undefined,
    timeMarker: {
      primaryColor: redis_meeting.markerPrimaryColor || "FF0000",
      secondaryColor: redis_meeting.markerSecondaryColor || "FFAA00",
      lineWidth: parseInt(redis_meeting.markerLineWidth) || 3,
      circleSize: parseInt(redis_meeting.markerCircleSize) || 8,
      height: parseInt(redis_meeting.markerHeight) || 100,
      glowIntensity: parseFloat(redis_meeting.markerGlowIntensity) || 0.3,
      pulseSpeed: parseInt(redis_meeting.markerPulseSpeed) || 200,
      style: redis_meeting.markerStyle || "modern", // modern, classic, minimal, arrow
      showGlow: redis_meeting.markerShowGlow === 'on' || redis_meeting.markerShowGlow === true,
      showCircle: redis_meeting.markerShowCircle === 'on' || redis_meeting.markerShowCircle === true,
      showLine: redis_meeting.markerShowLine === 'on' || redis_meeting.markerShowLine === true,
      textStyle: {
        fontSize: parseInt(redis_meeting.markerTextSize) || 14,
        color: redis_meeting.markerTextColor || "FFFFFF",
        backgroundColor: redis_meeting.markerTextBg || "000000",
        backgroundAlpha: parseFloat(redis_meeting.markerTextBgAlpha) || 0.7,
        showBackground: redis_meeting.markerTextShowBg === 'on' || redis_meeting.markerTextShowBg === true,
        fontFamily: redis_meeting.markerTextFont || "monospace"
      }
    }
  };


  // To keep things simple, we only ask for the time, and we use the current day as the date
  const now = new Date();
  const now_date = date.format(now, "YYYY-MM-DD");


  // If we get 1:00PM, pad with a zero to 01:00PM
  let start_time = redis_meeting.start_time;
  let timezone = redis_meeting.timezone;

  if( start_time.split(":")[0].length == 1 )
  {
    start_time = "0" + start_time;
  }

  // We start with the time we were given for when the meeting starts
  const start = now_date + " " + start_time;

  // We then add the timezone that was given
  // Now the person using the page will see this in their timezone, but it will be altered by the TZ selected
  // let startTime = momentTZ.tz(start, "YYYY-MM-DD hh:mm A", timezone).toDate();
  let startTime = momentTZ.tz(start, "YYYY-MM-DD hh:mm A", timezone).toDate();


  let topics = [];
  let total_duration = 0;

  if( Array.isArray(redis_meeting.topic) )
  {
    let counter = 0;
    redis_meeting.topic.forEach(element => {
      let duration = parseDuration(redis_meeting.duration[counter]);

      topics.push({
        "person" : redis_meeting.person[counter],
        "topic" : element,
        "time" : duration
      });
      total_duration += duration;
      counter++;
    });
  }
  else
  {
    topics.push({
      "person" : redis_meeting.person,
      "topic" : redis_meeting.topic,
      "time" : parseDuration(redis_meeting.duration)
    });
    total_duration += parseDuration(redis_meeting.duration);
  }


  // Calculate end time based on the durations from the topics
  const additional_minutes_for_padding_at_end = 2;
  var end = date.addMinutes(startTime, total_duration + additional_minutes_for_padding_at_end);

  meeting = {
    "meeting_id": redis_meeting.meeting_id,
    "title": redis_meeting.title,
    "start": startTime,
    "end": end,
    "duration": total_duration,
    "num_topics": topics.length,
    "topics": topics,
    "background": background,
    "timezone": redis_meeting.timezone,
    "icon": icon,
    "config": config
  }

  console.log("=== Normalized Data to Pass to General Parser ===");
  console.log(meeting);
  console.log("==================================================");

  return getData(meeting);
}

function getData(meeting){
  totalTime_seconds = date.subtract(meeting.end,meeting.start).toSeconds();
  totalTime_mins = date.subtract(meeting.end,meeting.start).toMinutes();

  // Width of display should handle 1 hour meetings easily
  let windowWidth = 950;

  // We need to calulate how fast the marker should be moving relative to the width and total_time
  meeting.movement_rate = totalTime_seconds / windowWidth;

  let location = 0;
  let counter = 0;
  let initial_offset = 10;
  let prev_width = 0;
  let prev_time = 0;

  meeting.topics.forEach(element => {
   element.id = counter;
   percent_of_total_width = Math.round(((element.time / totalTime_mins) * windowWidth),1);


   if( counter == 0 )
   {
     location = 0;
     element.startTime = meeting.start;
   }
   else {
     location += prev_width;
     element.startTime = date.addMinutes(meeting.start,prev_time);
   }

   element.width = percent_of_total_width;
   element.location = location;

   prev_width = percent_of_total_width;
   prev_time += element.time;

   counter++;
  });

  return meeting;
}


function get_short_hash()
{
  var hrTime = process.hrtime();
  const now = hrTime[0] * 1000000 + hrTime[1];
  const hash = sha3(Math.random() + "saltymargs" + now) + "";
  const short_hash = hash.substr(0,10);
  return short_hash;
}



router.get('/list', (req, res) => {
  console.log("/list called");

  var recent_meeting_ids = [];

  client.keys('meeting_*', function (err, keys) {
    if (err) return console.log(err);

    if( keys.length == 0 )
    {
      return res.json([]);
    }

    // Get more details from redis for each key
    client.mget(keys, function (err, meeting_infos) {
      if (err) return console.log(err);

      meeting_infos.forEach((item, i) => {
        const meeting_details = JSON.parse(item);
        const pretty_meeting_details = getDataFromRedis(meeting_details);

        recent_meeting_ids.push(pretty_meeting_details);
      });


      res.json(recent_meeting_ids)
    });

  });
});

router.get('/edit/:meetingId', (req, res) => {

    const meeting_id = req.params.meetingId;
    const meeting_id_for_redis = "meeting_" + meeting_id;

    console.log("~~ GET /edit/meetingId REQUEST ID: " + meeting_id);

    // 1. Get data out of Redis
    client.get(meeting_id_for_redis, (err, redis_data) => {
      const meeting = JSON.parse(redis_data);

      if( meeting == null )
      {
       return res.send(404);
      }

      // Reconstruct config object from form data (which is stored flat in Redis)
      // This handles both old nested config format and new flat form submission format
      meeting.config = {
        titleFontSize: parseInt(meeting.titleFontSize) || (meeting.config && meeting.config.titleFontSize) || 24,
        blockFontSize: parseInt(meeting.blockFontSize) || (meeting.config && meeting.config.blockFontSize) || 11,
        timeLabelFontSize: parseInt(meeting.timeLabelFontSize) || (meeting.config && meeting.config.timeLabelFontSize) || 10,
        showDebug: meeting.showDebug === 'on' || meeting.showDebug === true || (meeting.config && meeting.config.showDebug) || false,
        showProgressBars: meeting.showProgressBars === 'on' || meeting.showProgressBars === true || (meeting.config && meeting.config.showProgressBars !== false) || true,
        showStatusIcons: meeting.showStatusIcons === 'on' || meeting.showStatusIcons === true || (meeting.config && meeting.config.showStatusIcons !== false) || true,
        showTimeLabels: meeting.showTimeLabels === 'on' || meeting.showTimeLabels === true || (meeting.config && meeting.config.showTimeLabels !== false) || true,
        animationSpeed: parseFloat(meeting.animationSpeed) || (meeting.config && meeting.config.animationSpeed) || 1.0,
        segmentHeight: parseInt(meeting.segmentHeight) || (meeting.config && meeting.config.segmentHeight) || 50,
        colors: {
          completed: meeting.completedColor || (meeting.config && meeting.config.colors && meeting.config.colors.completed) || "404040",
          current: meeting.currentColor || (meeting.config && meeting.config.colors && meeting.config.colors.current) || "FF6600", 
          upcoming: meeting.upcomingColor || (meeting.config && meeting.config.colors && meeting.config.colors.upcoming) || "0099CC",
          completedAlpha: parseFloat(meeting.completedAlpha) || (meeting.config && meeting.config.colors && meeting.config.colors.completedAlpha) || 0.6,
          currentAlpha: parseFloat(meeting.currentAlpha) || (meeting.config && meeting.config.colors && meeting.config.colors.currentAlpha) || 0.9,
          upcomingAlpha: parseFloat(meeting.upcomingAlpha) || (meeting.config && meeting.config.colors && meeting.config.colors.upcomingAlpha) || 0.4
        },
        missionControlTheme: meeting.missionControlTheme === 'on' || meeting.missionControlTheme === true || (meeting.config && meeting.config.missionControlTheme !== false) || true,
        timeMarker: {
          primaryColor: meeting.markerPrimaryColor || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.primaryColor) || "FF0000",
          secondaryColor: meeting.markerSecondaryColor || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.secondaryColor) || "FFAA00",
          lineWidth: parseInt(meeting.markerLineWidth) || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.lineWidth) || 3,
          circleSize: parseInt(meeting.markerCircleSize) || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.circleSize) || 8,
          height: parseInt(meeting.markerHeight) || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.height) || 100,
          glowIntensity: parseFloat(meeting.markerGlowIntensity) || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.glowIntensity) || 0.3,
          pulseSpeed: parseInt(meeting.markerPulseSpeed) || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.pulseSpeed) || 200,
          style: meeting.markerStyle || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.style) || "modern",
          showGlow: meeting.markerShowGlow === 'on' || meeting.markerShowGlow === true || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.showGlow !== false) || true,
          showCircle: meeting.markerShowCircle === 'on' || meeting.markerShowCircle === true || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.showCircle !== false) || true,
          showLine: meeting.markerShowLine === 'on' || meeting.markerShowLine === true || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.showLine !== false) || true,
          textStyle: {
            fontSize: parseInt(meeting.markerTextSize) || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.textStyle && meeting.config.timeMarker.textStyle.fontSize) || 14,
            color: meeting.markerTextColor || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.textStyle && meeting.config.timeMarker.textStyle.color) || "FFFFFF",
            backgroundColor: meeting.markerTextBg || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.textStyle && meeting.config.timeMarker.textStyle.backgroundColor) || "000000",
            backgroundAlpha: parseFloat(meeting.markerTextBgAlpha) || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.textStyle && meeting.config.timeMarker.textStyle.backgroundAlpha) || 0.7,
            showBackground: meeting.markerTextShowBg === 'on' || meeting.markerTextShowBg === true || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.textStyle && meeting.config.timeMarker.textStyle.showBackground !== false) || true,
            fontFamily: meeting.markerTextFont || (meeting.config && meeting.config.timeMarker && meeting.config.timeMarker.textStyle && meeting.config.timeMarker.textStyle.fontFamily) || "monospace"
          }
        }
      };

      console.log("=== Reconstructed config for edit page ===");
      console.log("titleFontSize:", meeting.config.titleFontSize);
      console.log("blockFontSize:", meeting.config.blockFontSize);
      console.log("timeLabelFontSize:", meeting.config.timeLabelFontSize);
      console.log("timeMarker primaryColor:", meeting.config.timeMarker.primaryColor);
      console.log("==========================================");

      res.render('edit_meeting',{
        id: meeting_id,
        all_timezones: momentTZ.tz.names(),
        meeting: meeting
      });

    });
});


router.get('/:meetingId', (req, res) => {
    const meeting_id = req.params.meetingId;
    const meeting_id_for_redis = "meeting_" + meeting_id;
    console.log("~~ GET /meetingId REQUEST ID: " + meeting_id);


    // 1. Get data out of Redis
    client.get(meeting_id_for_redis, (err, redis_data) => {

      // 1a. If the key doesn't exist, use the default json
       if (err) {
         const meeting = fs.readFileSync('./meeting-details.json');

         // 2. Parse and pass data into refinement stage
         data = getData(meeting);
       }
       else {
         // 1b. Parse the data from Redis
         const meeting = JSON.parse(redis_data);

         if( meeting == null )
         {
           return res.send(404);
         }

         // 2. Parse and pass data into refinement stage
         data = getDataFromRedis(meeting);
       }


      res.render('meeting',{
        id: meeting_id,
        title: data.title,
        topics: data.topics,
        start: data.start,
        background: data.background,
        movement_rate: data.movement_rate,
        icon: data.icon,
        config: data.config
      });
    });
});




router.post('/:meetingId', (req, res) => {
  const meeting_id = req.params.meetingId;
    const meeting_id_for_redis = "meeting_" + meeting_id;
    client.set(meeting_id_for_redis, JSON.stringify(req.body));
    res.redirect("/meeting/" + meeting_id);
});

router.get('/', (req, res) => {
  var recent_meeting_ids = [];
  client.keys('meeting_*', function (err, keys) {
    if (err) return console.log(err);

    for(var i = 0, len = keys.length; i < len; i++) {
      recent_meeting_ids.push(keys[i]);
    }

    var all_timezones = momentTZ.tz.names();
    var timezone_selection = [];
    const popular_timezones = ["US/Pacific", "America/Phoenix", "US/Eastern", "Asia/Kolkata"];
    Array.prototype.push.apply(timezone_selection, popular_timezones);

    all_timezones.forEach((item, i) => {
      if( !popular_timezones.includes(item) )
      {
        timezone_selection.push(item);
      }
    });
    // Put common ones at the top



    res.render('create_meeting',{
      id: get_short_hash(),
      all_timezones: timezone_selection,
      recent_meetings: recent_meeting_ids
    });
  });
});


module.exports = router;
