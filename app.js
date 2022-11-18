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
app.get('/profile', routes.get_my_profile);
app.get('/profile/:login', routes.get_profile);
app.post('/search', routes.search_user);
app.get('/logout', routes.logout_user);

/**
 * Routes for wall
 */
app.get('/wall', routes.get_wall);

/**
 * Routes for homepage
 */
app.get('/homepage', routes.get_homepage);

app.listen(8080);
console.log('Server running on port 8080.')