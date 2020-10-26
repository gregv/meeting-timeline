const path = require('path');
const fs = require('fs');
var express = require('express');
var app = express();
const date = require('date-and-time');

app.set('view engine', 'ejs');
app.use( express.static( "public" ) );


function getData(){
  let data = fs.readFileSync('meeting-details.json');
  let meeting = JSON.parse(data);

  startTime = new date.parse(meeting.start, "YYYY-MM-DD hh:mm A", false);
  endTime = new date.parse(meeting.end, "YYYY-MM-DD hh:mm A", false);

  totalTime_seconds = date.subtract(endTime,startTime).toSeconds();
  totalTime_mins = date.subtract(endTime,startTime).toMinutes();

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
      element.startTime = date.format(startTime,'hh:mmA');
    }
    else {
      location += prev_width;
      element.startTime = date.format(date.addMinutes(startTime,prev_time), 'hh:mmA') ;
    }

    element.width = percent_of_total_width;
    element.location = location;

    prev_width = percent_of_total_width;
    prev_time += element.time;


    counter++;
  });

  return meeting;
}

app.get('/', (req, res) => {
    let data = getData();
    console.log(data);
    res.render('index',{
      title: data.title,
      topics: data.topics,
      start: data.start,
      background: data.background,
      movement_rate: data.movement_rate
    });
});

app.listen(3000, () => console.log('~~App listening on port 3000!'));
