var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
const {v4: uuidv4} = require('uuid');

var myDB_create_chat = function(user_1, user_2, callback) {
	console.log("Creating chat between " + user_1 + " and " + user_2);
	id = uuidv4().toString();
	console.log(id);
	var params = {
		RequestItems: {
			"chats": [
				{
					PutRequest: {
						Item: {
					       "users": {
					          SS: [user_1, user_2]
					        },
					        "chat_id": { 
					          S: id
					        },
					        "group_chat": {
							  S: "false" // group chat status initially false
							}
				       }
					}
				}
			]
		}
	};
	
	
    db.batchWriteItem(params, function(err, data) {
		if (err) {
			callback(err);
		} else {
			var params2 = {
				RequestItems: {
					"user_in_chat": [
						{
							PutRequest: {
								Item: {
							       "login": {
							          S: user_1
							        },
							        "chat_id": {
										S: id
									}
								}
						      }
							},
						{
							PutRequest: {
								Item: {
							       "login": {
							          S: user_2
							        },
							        "chat_id": {
										S: id
									}
						       }
							}
						}
					]
				}
			};
			db.batchWriteItem(params2, function(err2, data2) {
				if (err2) {
					callback(err2);
				} else {
					var params3 = {
						RequestItems: {
							"chat_users": [
								{
									PutRequest: {
										Item: {
									       "user": {
									          S: user_1
									        },
									        "chat_id": {
												S: id
											}
										}
								      }
									},
								{
									PutRequest: {
										Item: {
									       "user": {
									          S: user_2
									        },
									        "chat_id": {
												S: id
											}
								       }
									}
								}
							]
						}
					};
					db.batchWriteItem(params3, function(err3, data3){
						if (err3) {
							callback(err3);
						} else {
							callback(null, id);
						}
					}); 
				}
			});
		}
	});
}

// checks if two users have been in chatroom before
var myDB_check_chat = function(user_1, user_2, callback) {
	console.log("Checking for chat between " + user_1 + " and " + user_2);
	
	var params = {
      KeyConditions: {
        user_1: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: user_1} ]
        },
        user_2: {
			ComparisonOperator: 'EQ',
			AttributeValueList: [ {S: user_2} ]
		}
      },
      TableName: "chats",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
	  callback(err, data);
    }
  });
	
}


var myDB_get_messages = function(chat_id, callback) {
	console.log("Getting messages for chat: " + chat_id);
	
	var params = {
      KeyConditions: {
        chat_id: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: chat_id} ]
        },
      },
      TableName: "messages",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
	  callback(err, data);
    }
  });
	
}

var myDB_add_message = function(chat_id, content, time, user, callback) {
  console.log('Adding: ' + content); 
  
  var params = {
      Item: {
       "chat_id": {
          S: chat_id
        },
        "content": { 
          S: content
        },
        "time_sent": {
		  S: time
		},
		"sender": {
			S: user
		}
      },
      TableName: 'messages',
      ReturnValues: 'NONE'
  };

  db.putItem(params, function(err, data){
    if (err)
      callback(err);
    else
      callback(null, 'Success');
  });
}

// updates both the user_chats table and users_in_chat table to reflect added user, should also change group chat status to true
// since this is only called in group chat accept (for now at least)
var myDB_add_user_to_chat = function(login, chat_id, callback) {
  var params = {
				RequestItems: {
					"user_in_chat": [
						{
							PutRequest: {
								Item: {
							       "login": {
							          S: login
							        },
							        "chat_id": {
										S: chat_id
									}
								}
						      }
							}
					]
				}
			};
	db.batchWriteItem(params, function(err, data) {
		if (err) {
			callback(err);
		} else {
			var params2 = {
				RequestItems: {
					"chat_users": [
						{
							PutRequest: {
								Item: {
							       "user": {
							          S: login
							        },
							        "chat_id": {
										S: chat_id
									}
								}
						      }
							},
					]
				}
			};
			db.batchWriteItem(params2, function(err2, data2){
				if (err2) {
					callback(err2, null);
				} else {
					// update group chat status in chats table to true
					var params3 = {
				        Key: {
				            'chat_id': { S: chat_id }
				        },
				        TableName: 'chats',
				        UpdateExpression: 'set group_chat = :e',
				        ExpressionAttributeValues: {
				            ':e': { S: "true" }
				        },
				        ReturnValues: 'NONE'
				    };
				
				    db.updateItem(params3, function(err3, data3) {
				        if (err3) {
				            console.log(err3);
				            callback(err3, null);
				        } else {
				            callback(null, chat_id);
				        }
				    });
				}
			}); 
		}
	});
}

var myDB_get_user_chats = function(login, callback) {
	var params = {
      KeyConditions: {
        login: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: login} ]
        },
      },
      TableName: "user_in_chat",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
	  callback(err, data);
    }
  });
}

var myDB_get_chat_list_users = function(chat_list, index, users_list, callback) {
	var params = {
      KeyConditions: {
        chat_id: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: chat_list[index]} ]
        },
      },
      TableName: "chat_users",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
		var list = [];
		for (var item of data.Items) {
			list.push(item.user.S);
		}
		users_list.push(list);
		if (index == chat_list.length - 1) {
			// recursion finished, use callback
			callback(err, users_list);
		} else {
			myDB_get_chat_list_users(chat_list, index + 1, users_list, callback);
		}
    }
  });
}

// sends a chat invite to create a private chat
var myDB_add_chat_invite_private = function(user, sender, callback) {
	var params = {
      Item: {
       "user": {
          S: user
        },
        "sender": {
		  S: sender
		}
      },
      TableName: 'chat_invites_new',
      ReturnValues: 'NONE'
  };
  
  db.putItem(params, function(err, data){
    if (err)
      callback(err);
    else
      callback(null, "Success");
  });
}

// sends a chat invite to join an existing chat
var myDB_add_chat_invite_group = function(user, chat_id, sender, callback) {
	var params = {
      Item: {
       "user": {
          S: user
        },
        "chat_id": { 
          S: chat_id
        },
        "sender": {
		  S: sender
		}
      },
      TableName: 'group_chat_invites',
      ReturnValues: 'NONE'
  };
  
  db.putItem(params, function(err, data){
    if (err)
      callback(err);
    else
      callback(null, chat_id);
  });
}

// remove the invite and create the chat
var myDB_accept_private_invite = function(user, sender, callback) {
	myDB_create_chat(sender, user, function(err, chat_id){
		if (err) {
			console.log(err);
			callback(err, null);
		} else {
			myDB_delete_private_invite(user, sender, function(err2, data) {
				if (err2) {
					console.log(err2);
					callback(err2, null);
				} else {
					callback(null, chat_id)
				}
			});
		}
	});
}

var myDB_delete_private_invite = function(user, sender, callback) {
	var params = {
      Item: {
       "user": {
          S: user
        },
        "sender": {
		  S: sender
		}
      },
      TableName: 'chat_invites_new',
      ReturnValues: 'NONE'
    };
    
    db.deleteItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			callback(null, "Success");
		}
	});
  
}

// removes the group chat invite and adds the user to the chat, changing it to a group chat
var myDB_accept_group_invite = function(user, chat_id, callback) {
	myDB_add_user_to_chat(user, chat_id, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			myDB_delete_group_invite(user, chat_id, function(err2, data2) {
				if (err2) {
					callback(err2, null);
				} else {
					callback(null, chat_id);
				}
			});
		}
	});
}

var myDB_delete_group_invite = function(user, chat_id, callback) {
	
	var params = {
      Item: {
       "user": {
          S: user
        },
        "chat_id": {
		  S: chat_id
		}
      },
      TableName: 'group_chat_invites',
      ReturnValues: 'NONE'
    };
    
    db.deleteItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			callback(err, "Success");
		}
	});
}



var database = { 
  createChat: myDB_create_chat,
  checkChat: myDB_check_chat,
  getMessages: myDB_get_messages,
  addMessage: myDB_add_message,
  addUserChat: myDB_add_user_to_chat,
  getUserChats: myDB_get_user_chats,
  getChatUsersList: myDB_get_chat_list_users,
  addChatInvitePrivate: myDB_add_chat_invite_private,
  addChatInviteGroup: myDB_add_chat_invite_group,
  acceptPrivateInvite: myDB_accept_private_invite,
  deletePrivateInvite: myDB_delete_private_invite,
  acceptGroupInvite: myDB_accept_group_invite,
  deleteGroupInvite: myDB_delete_group_invite
};

module.exports = database;
















