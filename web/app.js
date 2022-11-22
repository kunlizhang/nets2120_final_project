var express = require('express');
var routes = require('./routes/routes.js');
var session = require('express-session');
var app = express()
app.use(session({secret: "mySecret"})); //Not sure if I am using sessions properly here?
app.use(express.urlencoded());

app.use(express.static(__dirname + '/public'));

/**
 * Routes for user
 */
app.get('/', routes.get_main);
app.post('/checklogin', routes.check_login);
app.get('/signup', routes.signup);
app.post('/createaccount', routes.create_account);
app.get('/logout', routes.logout_user);

/** 
 * Routes for search
 */

 app.post('/search', routes.search_user_redirect);
 app.get('/search/:keyword', routes.search_user);
 app.post('/searchJSON', routes.search_JSON);

/**
 * Routes for profile
 */

 app.get('/profile', routes.get_my_profile);
 app.get('/profile/:login', routes.get_profile);
 app.post('/getFriendStatus', routes.get_friend_status);
 app.post('/addFriend', routes.add_friend);
 app.post('/deleteFriend', routes.delete_friend);

/**
 * Routes for wall
 */
 app.get('/wall/:login', routes.get_wall);

/**
 * Routes for homepage
 */
app.get('/homepage', routes.get_homepage);

app.listen(8080);
console.log('Server running on port 8080.')