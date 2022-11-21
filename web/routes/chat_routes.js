const { application } = require('express');
var db = require('../models/chat_database.js');

var getCreateChat = function(req, res) {
	// add session stuff here later so users can't be on this page without being logged in
	res.render('createChat.ejs');
}

var showChat = function(req, res) {
	// session stuff to prevent non-logged in user
	var user_1 = req.body.user_1; // to be replaced with req.session stuff
	var user_2 = req.body.user_2;
	if (user_1 == "" || user_2 == "") {
		res.redirect('/createChat?error=1')
	} else {
		db.checkChat(user_1, user_2, function(err, data) {
			if (err) {
				console.log(err);
				res.redirect('/createChat?error=2')
			} else if (data.Items.length == 0) {
				db.createChat(user_1, user_2, function(err, data) {
					if (err) {
						console.log(err);
						res.redirect('/createChat?error=2');
					} else {
						res.redirect('/chat?id=' + data);
					}
				});
			} else {
				// get old chats for rendering
				db.getMessages(data.Items[0].chat_id.S, function(err, data) {
					if (err) {
						res.redirect('/createChat?error=2');
					} else {
						res.render('chat.ejs', {messages: data.Items});
					}
				});
			}
		});
	}
}