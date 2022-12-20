const { application } = require('express');
var db = require('../models/chat_database.js');
var main_db = require('../models/database.js');

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
				var list = [];
				for (item of data.Items) {
					list.push(item.chat_id.S);
				}
				if (list.length > 0) {
					db.getChatUsersList(list, 0, [], function(err3, data3){
						if (err3) {
							res.redirect('/createChat?error=2');
						} else {
							db.getPrivateInvites(user_1, function (err4, data4) {
								if (err4) {
									console.log(err4);
									res.redirect('/createChat?error=2')
								} else {
									db.getGroupInvites(user_1, function(err5, data5) {
										if (err5) {
											console.log(err5);
											res.redirect('/createChat?error=2');
										} else {
											db.getOutgoingInvites(user_1, function(err6, data6) {
												if (err6) {
													console.log(err6);
													res.redirect('/createChat?error=2');
												} else {
													console.log("online users");
													main_db.update_user_online(user_1, new Date().toJSON(), function(err) {
														if (err) {
															console.log(err);
															res.redirect('/createChat?error=2');
														} else {
															main_db.get_online_friends(user_1, function(data2) {
																res.render('createChat.ejs', {user_chats: data.Items, chat_users_list: data3, online_friends: data2, error: req.query.error, private_invites: data4.Items, group_invites: data5.Items, outgoing_invites: data6.Items});
															});
														}
													});
												}
											});
										}
									});
								}
							});
						}
					});
				} else {
					db.getPrivateInvites(user_1, function (err4, data4) {
								if (err4) {
									console.log(err4);
									res.redirect('/createChat?error=2')
								} else {
									db.getGroupInvites(user_1, function(err5, data5) {
										if (err5) {
											console.log(err5);
											res.redirect('/createChat?error=2');
										} else {
											db.getOutgoingInvites(user_1, function(err6, data6) {
												if (err6) {
													console.log(err6);
													res.redirect('/createChat?error=2');
												} else {
													console.log("online users");
													main_db.update_user_online(user_1, new Date().toJSON(), function(err) {
														if (err) {
															console.log(err);
															res.redirect('/createChat?error=2');
														} else {
															main_db.get_online_friends(user_1, function(data2) {
																res.render('createChat.ejs', {user_chats: data.Items, chat_users_list: [], online_friends: data2, error: req.query.error, private_invites: data4.Items, group_invites: data5.Items, outgoing_invites: data6.Items});
															});
														}
													});
												}
											});
										}
									});
								}
							});
				}
				
				
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
		// check if user is in chat_id, redirect to home if not
		db.getUserChats(user, function(err, data) {
			if (err) {
				console.log(err);
				res.redirect('/createChat?error=2');
			} else {
				var user_in_chat = false;
				data.Items.forEach(function (element, index, array) {
					if (element.chat_id.S === chat_id) {
						user_in_chat = true;
					}
				});
				if (user_in_chat) {
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
							main_db.update_user_online(user, new Date().toJSON(), function(err2) {
								if (err2) {
									console.log(err2);
									res.redirect('/createChat?error=2');
								} else {
									main_db.get_online_friends(user, function(data2) {
										res.render('chat.ejs', {username: user, messages: data.Items, online_friends: data2, error: req.query.error})
									});
								}
							});
						}
					});
				} else {
					res.redirect('/homepage');
				}
			}
		});
	}
}

var getOnlineFriends = function(req, res) {
  var user = req.session.login;
  main_db.get_online_friends(user, function(data) {
    res.send({online_friends: data});
  });
}

var addMessage = function(req, res) {
	var chat_id = req.body.chat_id;
	var content = req.body.content;
	var sender = req.session.login;
	var time_sent = req.body.time;
	// check if the chat exists before sending message, needed if private chat left by other user while one still in
	db.checkForChat(chat_id, function(err1, data1) {
		if (err1) {
			console.log(err1);
			res.send({success: false});
		} else {
			if (data1) {
				db.addMessage(chat_id, content, time_sent, sender, function(err, data) {
					if (err) {
						console.log(err);
						res.send({success: false});
					} else {
						console.log("success");
						res.send({success: true});
					}
				});
			} else {
				// chat doesn't exist, let user know
				res.send({success: false, nochat: true});
			}
		}
	});
}

var sendChatInvitePrivate = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var sender = req.session.login;
	var user = req.body.user;
	db.checkForInvite(user, sender, function(err1, data1) {
		if (err1) {
			console.log(err1);
			res.send({success: false});
		} else {
			if (!data1) {
				db.addChatInvitePrivate(user, sender, function(err, data){
					if (err) {
						console.log(err);
						res.send({success: false});
					} else {
						console.log("Invite added to " + user);
						res.send({success: true, exists: false}); 
					}	
				});
			} else {
				res.send({success: true, exists: true});
			}
		}
	});
}

var sendChatInviteGroup = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var sender = req.session.login;
	var user = req.body.user; 
	var chat_id = req.body.chat_id; 
	// check if user is in chat_id
	db.getUserChats(user, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false});
		} else {
			var user_in_chat = false;
			data.Items.forEach(function (element, index, array) {
				if (element.chat_id.S === chat_id) {
					user_in_chat = true;
				}
			});
			if (!user_in_chat) {
				db.checkForGroupInvite(user, chat_id, function(err2, data2) {
					if (err2) {
						console.log(err2);
						res.send({success: false});
					} else {
						if (!data2) {
							db.addChatInviteGroup(user, chat_id, sender, function(err1, data1){
								if (err1) {
									console.log(err1);
									res.send({success: false});
								} else {
									console.log("Invite added to " + user);
									res.send({success: true, in_chat: false}); 
								}
							});
						} else {
							res.send({success: true, in_chat: false});
						}
					}
				});
			} else {
				res.send({success: true, in_chat: true});
			}
		}
	});
}

var acceptChatInvitePrivate = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	var sender = req.body.sender; 
	db.acceptPrivateInvite(user, sender, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false});
		} else {
			console.log("Invite from " + sender + " accepted.");
			res.send({success: true}); 
		}
	});
}

// called when invite rejected
var deletePrivateInvite = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	var sender = req.body.sender;
	db.deletePrivateInvite(user, sender, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false});
		} else {
			console.log("Invite from " + sender + " deleted.");
			res.send({success: true}); 
		}
	});
}

var acceptGroupInvite = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	var chat_id = req.body.chat_id; 
	var sender = req.body.sender;
	db.acceptGroupInvite(user, chat_id, sender, function (err, data) {
		if (err) {
			console.log(err);
			res.send({success: false});
		} else {
			console.log("Invite to " + chat_id + " accepted.");
			res.send({success: true}); 
		}
	});
}

var deleteGroupInvite = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	var chat_id = req.body.chat_id; 
	var sender = req.body.sender;
	db.deleteGroupInvite(user, chat_id, sender, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false});
		} else {
			console.log("Invite to " + chat_id + " deleted.");
			res.send({success: true});
		}
	});
}

var leaveChat = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	var chat_id = req.body.chat_id; 
	db.leaveChat(user, chat_id, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false});
		} else {
			console.log("Left chat: " + chat_id + ".");
			res.send({success: true});
		}
	});
}

var getPrivateInvites = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	db.getPrivateInvites(user, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			res.send({invites: data.Items});
		}
	});
}

var getGroupInvites = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	db.getGroupInvites(user, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			res.send({invites: data.Items});
		}
	});
}

var getOutgoingInvites = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	db.getOutgoingInvites(user, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			res.send({invites: data.Items});
		}
	});
}

var getChats = function(req, res) {
	if (!req.session.login) {
		res.redirect('/');
	}
	var user = req.session.login;
	db.getUserChats(user, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			res.send({chats: data.Items});
		}
	});
}

var routes = {
	get_create_chat: getCreateChat,
	make_chat: makeChat,
	show_chat: showChat,
	add_message: addMessage,
	send_chat_invite_private: sendChatInvitePrivate,
	send_chat_invite_group: sendChatInviteGroup,
	accept_private_invite: acceptChatInvitePrivate,
	delete_private_invite: deletePrivateInvite,
	accept_group_invite: acceptGroupInvite,
	delete_group_invite: deleteGroupInvite,
	leave_chat: leaveChat,
	get_private_invites: getPrivateInvites,
	get_group_invites: getGroupInvites,
	get_online_friends: getOnlineFriends,
	get_outgoing_invites: getOutgoingInvites,
	get_chats: getChats
};

module.exports = routes;

