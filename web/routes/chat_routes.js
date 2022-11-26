const { application } = require('express');
var db = require('../models/chat_database.js');

var getCreateChat = function(req, res) {
	if (!req.session.login) {
        res.redirect('/');
    } else {
		var user_1 = req.session.login;
		db.getUserChats(user_1, function(err, data) {
			if (err) {
				console.log(err);
				res.redirect('/createChat?error=2');
			} else {
				console.log(data);
				res.render('createChat.ejs', {error: req.query.error, user_chats: data.Items});
			}
		});	
	}
}

// makes a chat by adding to chats table if not already there and then re-renders the page with new chat available to go into
var makeChat = function(req, res) {
	if (!req.session.login) {
        res.redirect('/');
    } else {
		var user_1 = req.session.login;
		var user_2 = req.body.user_2;
		if (user_2 == "") {
			res.redirect('/createChat?error=1')
		} else {
			db.createChat(user_1, user_2, function(err, data) {
				if (err) {
					console.log(err);
					res.redirect('/createChat?error=2');
				} else {
					res.redirect('/createChat');
				}
			});
		}
	}
}

// redirects to chat page based on which chat user clicked on createChat page
var showChat = function(req, res) {
	if (!req.session.login) {
        res.redirect('/');
    } else {
		var user = req.session.login; 
		var chat_id = req.query.id;
		// get old messages in chat for rendering
		db.getMessages(chat_id, function(err, data){
			if (err) {
				console.log(err);
				res.redirect('/createChat?error=2')
			} else {
				// order the messages by their timestamp before sending
				var chats = data.Items;
				chats = chats.sort(function(m1, m2) {
					return (m1.time_sent.S).localeCompare(m2.time_sent.S);
				});
				res.render('chat.ejs', {username: user, messages: data.Items, error: req.query.error})
			}
		});
	}
	
}

var addMessage = function(req, res) {
	var chat_id = req.body.chat_id;
	var content = req.body.content;
	var sender = req.session.login;
	var time_sent = req.body.time; // for next milestone, figure out how to do timestamps for proper persistence
	if (content == "") {
		res.redirect('/chats?error=1');
	}
	db.addMessage(chat_id, content, time_sent, sender, function(err, data) {
		if (err) {
			console.log(err);
			res.redirect('/chats?error=2')
		} else {
			console.log("success");
			res.send({success: true});
		}
	});
}

var routes = {
	get_create_chat: getCreateChat,
	make_chat: makeChat,
	show_chat: showChat,
	add_message: addMessage
};

module.exports = routes;

