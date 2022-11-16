var express = require('express');
var routes = require('./routes/routes.js');
var session = require('express-session');
var app = express()
app.use(session({secret: "mySecret"})); //Not sure if I am using sessions properly here?
app.use(express.urlencoded());

/**
 * Routes for user
 */
app.get('/', routes.get_main);
app.post('/checklogin', routes.check_login);
app.get('/signup', routes.signup);
app.post('/createaccount', routes.create_account);

/**
 * Routes for wall
 */
app.get('/wall', routes.get_wall);

app.listen(8080);
console.log('Server running on port 8080.')