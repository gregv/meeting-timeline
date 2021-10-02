const app = require('./app');
const express = require('express');
const helmet = require("helmet");
app.use(helmet());
app.set('view engine', 'ejs');
app.use( express.static( "public" ) );


const server = app.listen(3000, () => {
  console.log(`Express is running on port ${server.address().port}`);
});
