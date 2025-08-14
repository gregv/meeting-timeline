// Load environment variables
require('dotenv').config();

const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const route_index = require('./routes/index');
const route_meeting = require('./routes/meeting');
const route_auth = require('./routes/auth');
const { passport } = require('./config/auth');

const app = express();

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Make user available in templates
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Routes
app.use('/auth', route_auth);
app.use('/meeting', route_meeting);
app.use('/', route_index);


module.exports = app;
