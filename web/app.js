var express = require('express');
var routes = require('./routes/routes.js');
var chatRoutes = require('./routes/chat_routes.js');
var newsRoutes = require('./routes/news_routes.js');
var session = require('express-session');
var app = express();
var http = require("http").Server(app);
var io = require('socket.io')(http);
app.use(session({secret: "mySecret"})); //Not sure if I am using sessions properly here?
app.use(express.urlencoded());
app.use(express.static(__dirname + '/public'));

// io for chat
io.on("connection", function(socket) {
	socket.on("message sent", function(obj) {
		console.log("Sent to room: " + obj.room);
		io.to(obj.room).emit("message sent", obj);
	});
	
	socket.on("join room", function(obj) {
		console.log("Joined room: " + obj.room);
		socket.join(obj.room);
	});
	
	socket.on("leave room", function(obj) {
		socket.leave(obj.room);
	});
});

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
 app.post('/getFriends', routes.get_friends);
 app.post('/addFriend', routes.add_friend);
 app.post('/deleteFriend', routes.delete_friend);
 app.post('/changeAffiliation', routes.change_affiliation);
 app.post('/changeEmail', routes.change_email);
 app.post('/changePassword', routes.change_password);
 app.post('/changeInterests', routes.change_interests);

/**
 * Routes for wall
 */
 app.post('/getPosts', routes.get_posts);
 app.post('/makePost', routes.make_post);
 app.post('/makeComment', routes.make_comment);

/**
 * Routes for homepage
 */
app.get('/homepage', routes.get_homepage);

/**
 * Routes for chat
 */
app.get('/chats', chatRoutes.show_chat);
app.get('/createChat', chatRoutes.get_create_chat);
app.post('/addMessage', chatRoutes.add_message);
app.post('/makeChat', chatRoutes.make_chat);
app.post('/sendPrivateInvite', chatRoutes.send_chat_invite_private);
app.post('/sendGroupInvite', chatRoutes.send_chat_invite_group);
app.post('/acceptPrivate', chatRoutes.accept_private_invite);
app.post('/deletePrivateInvite', chatRoutes.delete_private_invite);
app.post('/acceptGroup', chatRoutes.accept_group_invite);
app.post('/deleteGroupInvite', chatRoutes.delete_group_invite);
app.post('/leaveChat', chatRoutes.leave_chat);
app.post('/getPrivateInvites', chatRoutes.get_private_invites);
app.post('/getGroupInvites', chatRoutes.get_group_invites);
app.post('/getOutgoingInvites', chatRoutes.get_outgoing_invites);
app.post('/getChats', chatRoutes.get_chats);
app.post('/getOnlineFriends', chatRoutes.get_online_friends);

/**
 * Routes for news feed
 */
app.get('/newsfeed', newsRoutes.get_news_feed);
app.post('/newsSearch', newsRoutes.search_articles);
app.post('/likeArticle', newsRoutes.like_news_article);
app.post('/unlikeArticle', newsRoutes.unlike_news_article);

/**
 * Routes for friend visualizer
 */
app.get('/friendvisualizer', routes.friend_visualizer);
app.post('/expandUser', routes.expand_user);

http.listen(8080);
console.log('Server running on port 8080.')
