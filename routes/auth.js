const express = require('express');
const router = express.Router();
const passport = require('passport');

// Login page
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    // If already logged in, check if there's a returnTo URL
    const returnTo = req.query.returnTo || req.session.returnTo;
    delete req.session.returnTo;
    
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      return res.redirect(returnTo);
    } else {
      return res.redirect('/meeting/');
    }
  }
  
  const returnTo = req.query.returnTo || req.session.returnTo;
  let returnMessage = null;
  let googleAuthUrl = '/auth/google';
  
  if (returnTo) {
    // Show user where they'll be redirected after login
    if (returnTo.includes('/meeting/')) {
      const meetingId = returnTo.split('/meeting/')[1];
      if (meetingId && meetingId.length > 0) {
        returnMessage = `After login, you'll be redirected to meeting ${meetingId}`;
      } else {
        returnMessage = "After login, you'll be redirected to the meeting dashboard";
      }
    } else {
      returnMessage = `After login, you'll be redirected to ${returnTo}`;
    }
    
    // Pass returnTo as state parameter to Google OAuth
    const encodedReturnTo = encodeURIComponent(returnTo);
    googleAuthUrl = `/auth/google?state=${encodedReturnTo}`;
  }
  
  res.render('login', { 
    title: 'Login - AgendaClock',
    error: req.query.error,
    returnMessage: returnMessage,
    googleAuthUrl: googleAuthUrl
  });
});

// Logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return next(err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/auth/login?message=logged_out');
    });
  });
});

// Google OAuth routes
router.get('/google', (req, res, next) => {
  // Extract state (returnTo URL) from query parameter
  const state = req.query.state;
  
  const authOptions = {
    scope: ['profile', 'email']
  };
  
  // Pass state through OAuth flow if provided
  if (state) {
    authOptions.state = state;
  }
  
  passport.authenticate('google', authOptions)(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/auth/login?error=auth_failed' 
  }),
  (req, res) => {
    // Successful authentication, redirect to original destination or default
    console.log('User logged in successfully:', req.user.email);
    
    // Get returnTo from state parameter (preferred) or session (fallback)
    const returnTo = req.query.state ? decodeURIComponent(req.query.state) : req.session.returnTo;
    delete req.session.returnTo; // Clean up the session
    
    console.log('ReturnTo from state:', req.query.state);
    console.log('Decoded returnTo:', returnTo);
    
    // Validate returnTo URL - only allow internal redirects for security
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      console.log('Redirecting to original destination:', returnTo);
      res.redirect(returnTo);
    } else {
      console.log('Redirecting to default meetings page');
      res.redirect('/meeting/');
    }
  }
);

// Check authentication status (API endpoint)
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;