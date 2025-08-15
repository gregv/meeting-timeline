const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
    // Check if user is authenticated
    if (req.isAuthenticated()) {
        res.redirect("/meeting/");
    } else {
        res.redirect("/auth/login");
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
