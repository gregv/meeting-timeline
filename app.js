const bodyParser = require('body-parser');
const express = require('express');
const route_index = require('./routes/index');
const route_meeting = require('./routes/meeting');

const app = express();

// https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application

//app.use(bodyParser.json());

// https://stackabuse.com/building-a-rest-api-with-node-and-express/
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/meeting', route_meeting);
app.use('/', route_index);


module.exports = app;
