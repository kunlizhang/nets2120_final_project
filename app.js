var express = require('express');
var routes = require('./routes/routes.js');
var session = require('express-session');
var app = express()
app.use(express.urlencoded());

/**
 * Routes for user
 */
app.get('/', routes.get_main);
app.get('/checklogin', routes.check_login);
app.get('/signup', routes.signup);

app.listen(8080);
console.log('Server running on port 8080.')