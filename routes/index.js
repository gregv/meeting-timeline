const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
    // Check if user is authenticated
    if (req.isAuthenticated()) {
        res.redirect("/meeting/");
    } else {
        res.render('login', { error: null });
    }
});

// SEO Landing Pages
router.get('/effective-meetings', (req, res) => {
    res.render('effective-meetings');
});

router.get('/managing-talkative-participants', (req, res) => {
    res.render('managing-talkative-participants');
});

router.get('/productive-meeting-tips', (req, res) => {
    res.render('productive-meeting-tips');
});

router.get('/meeting-agenda-timer', (req, res) => {
    res.render('meeting-agenda-timer');
});

router.get('/meeting-length-effectiveness', (req, res) => {
    res.render('meeting-length-effectiveness');
});

router.get('/ai-changing-meetings', (req, res) => {
    res.render('ai-changing-meetings');
});

router.get('/meeting-introductions-antipattern', (req, res) => {
    res.render('meeting-introductions-antipattern');
});

router.get('/timed-agenda', (req, res) => {
    res.render('timed-agenda');
});

router.get('/obs-setup', (req, res) => {
    res.render('obs_setup');
});

// SEO Files
router.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, '../public/sitemap.xml'));
});

router.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, '../public/robots.txt'));
});

module.exports = router;
