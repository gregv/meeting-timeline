const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    // Check if user is authenticated
    if (req.isAuthenticated()) {
        res.redirect("/meeting/");
    } else {
        res.redirect("/auth/login");
    }
});

module.exports = router;
