const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",        
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Extract user information from Google profile
      const user = {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        picture: profile.photos[0].value,
        provider: 'google'
      };
      
      console.log('User authenticated:', user.email);
      return done(null, user);
    } catch (error) {
      console.error('Auth error:', error);
      return done(error, null);
    }
  }
));

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from the session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Store the original URL the user was trying to access
  // Only store for GET requests to avoid issues with POST/form data
  if (req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
    // Also pass it as a query parameter for more reliable handling
    const encodedReturnTo = encodeURIComponent(req.originalUrl);
    return res.redirect(`/auth/login?returnTo=${encodedReturnTo}`);
  }
  
  res.redirect('/auth/login');
};

// Get user email for Redis key prefixing
const getUserEmail = (req) => {
  return req.user ? req.user.email : null;
};

// Generate user-specific Redis key
const getUserMeetingKey = (userEmail, meetingId) => {
  if (!userEmail) {
    throw new Error('User email required for meeting access');
  }
  return `meeting_${userEmail}_${meetingId}`;
};

// Generate public meeting Redis key
const getPublicMeetingKey = (meetingId) => {
  return `public_meeting_${meetingId}`;
};

// Check if user owns a meeting (for edit permissions on public meetings)
const isUserMeetingOwner = (userEmail, meetingId, meetingData) => {
  if (!meetingData || !userEmail) return false;
  return meetingData.owner_email === userEmail;
};

module.exports = {
  passport,
  requireAuth,
  getUserEmail,
  getUserMeetingKey,
  getPublicMeetingKey,
  isUserMeetingOwner
};