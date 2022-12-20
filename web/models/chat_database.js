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
									},
									"group_chat": {
										S: "false"
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

// checks if two users have an active private chat
var myDB_check_chat = function(user_1, user_2, callback) {
	console.log("Checking for chat between " + user_1 + " and " + user_2);
	myDB_get_user_chats(user_1, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			myDB_get_user_chats(user_2, function(err1, data1) {
				if (err1) {
					callback(err1, null);
				} else {
					var user_1_chats = data.Items;
					var user_2_chats = data1.Items;
					var common_chats_queries = [];
					for (chat of user_1_chats) {
						for (chat_other of user_2_chats) {
							if (chat.chat_id.S === chat_other.chat_id.S) {
								var params = {
							      KeyConditions: {
							        chat_id: {
							          ComparisonOperator: 'EQ',
							          AttributeValueList: [ {S: chat.chat_id.S} ]
							        },
							      },
							      TableName: "chats",
							    };
							    common_chats_queries.push(db.query(params).promise())
							    break;
							}	
						}
					}
					Promise.all(common_chats_queries).then(function(data) {
						var chat_exists = false;
						for (var i = 0; i < data.length; i++) {
							if (data[i].Items[0].group_chat.S === "false") {
								chat_exists = true;
								break;
							}
						}
						if (chat_exists) {
							callback(null, true);
						} else {
							callback(null, false);
						}
					});
				}
			});	
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
    else {
		var params1 = {
	      Item: {
	       "user": {
	          S: user
	        },
	        "sender": {
			  S: sender
			},
			"group_chat": {
				S: "false"
			}
	      },
	      TableName: 'outgoing_invites',
	      ReturnValues: 'NONE'
	  };
		
		db.putItem(params1, function(err1, data1) {
			if (err1)
				callback(err1);
			else {
				callback(null, "Success");
			}
		});
	}
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
      var params1 = {
	      Item: {
	       "user": {
	          S: user
	        },
	        "sender": {
			  S: sender
			},
			"group_chat": {
				S: "true"
			},
			"chat_id": {
				S: chat_id
			}
	      },
	      TableName: 'outgoing_invites',
	      ReturnValues: 'NONE'
	  };
		
		db.putItem(params1, function(err1, data1) {
			if (err1)
				callback(err1);
			else {
				callback(null, chat_id);
			}
		});
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
      Key: {
       "user": {
          S: user
        },
        "sender": {
		  S: sender
		}
      },
      TableName: 'chat_invites_new',
    };
    
    db.deleteItem(params, function(err, data) {
		if (err) {
			console.log("Error deleting from chat_invites_new");
			callback(err, null);
		} else {
			var params1 = {
		      Key: {
		       "user": {
		          S: user
		        },
		        "sender": {
				  S: sender
				}
		      },
		      "ExpressionAttributeValues": {
				":sk" : {S: "false"}
			  },
		      "ConditionExpression": "group_chat = :sk",
		      TableName: 'outgoing_invites',
		  };
		  	db.deleteItem(params1, function(err1, data1) {
			if (err1) {
				console.log("Error deleting from outgoing_invites");
				callback(err1, null);
			} else {
				callback(null, "Success");
			}
		});
		}
	});
  
}

// removes the group chat invite and adds the user to the chat, changing it to a group chat
var myDB_accept_group_invite = function(user, chat_id, sender, callback) {
	myDB_add_user_to_chat(user, chat_id, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			myDB_delete_group_invite(user, chat_id, sender, function(err2, data2) {
				if (err2) {
					callback(err2, null);
				} else {
					callback(null, chat_id);
				}
			});
		}
	});
}

var myDB_delete_group_invite = function(user, chat_id, sender, callback) {
	console.log("Removing group invite from: " + sender);
	var params = {
      Key: {
       "user": {
          S: user
        },
        "chat_id": {
		  S: chat_id
		}
      },
      TableName: 'group_chat_invites',
    };
    
    db.deleteItem(params, function(err, data) {
		if (err) {
			console.log("Error deleting from group_chat_invites");
			callback(err, null);
		} else {
			var params1 = {
		      Key: {
		       "user": {
		          S: user
		        },
		        "sender": {
				  S: sender
				}
		      },
		      "ExpressionAttributeValues": {
				":sk" : {S: chat_id}
			  },
		      "ConditionExpression": "chat_id = :sk",
		      TableName: 'outgoing_invites',
		  };
		  	db.deleteItem(params1, function(err1, data1) {
			if (err1) {
				console.log("Error deleting from outgoing_invites");
				callback(err1, null);
			} else {
				callback(null, "Success");
			}
		});
		}
	});
}

var myDB_leave_chat = function(user, chat_id, callback) {
	var params = {
      Key: {
       "user": {
          S: user
        },
        "chat_id": {
		  S: chat_id
		}
      },
      TableName: 'chat_users',
    };
    db.deleteItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			var params2 = {
		      Key: {
		       "login": {
		          S: user
		        },
		        "chat_id": {
				  S: chat_id
				}
		      },
		      TableName: 'user_in_chat',
		    };
		    db.deleteItem(params2, function(err2, data2) {
				if (err2) {
					callback(err2, null);
				} else {
					// check if chat is private or group
					var params3 = {
				      Key: {
						'chat_id': {S: chat_id}
					  },
				      TableName: 'chats',
				    };
					db.getItem(params3, function(err3, data3) {
						if (err3) {
							callback(err3, null);
						} else {
							// if private, delete chat and remove it from other user's list
							// if group, check that at least one user is still a member of the chat
							if (data3.Item.group_chat.S === 'false') {
								// get the other user's name
								var other;
								for (login of data3.Item.users.SS) {
									if (login !== user) {
										other = login;
									}
								}
								
								var params_other = {
							      Key: {
							       "user": {
							          S: other
							        },
							        "chat_id": {
									  S: chat_id
									}
							      },
							      TableName: 'chat_users',
							    };
							    
							    var params_other1 = {
							      Key: {
							       "login": {
							          S: other
							        },
							        "chat_id": {
									  S: chat_id
									}
							      },
							      TableName: 'user_in_chat',
							    };
								
								var params4 = {
							      Key: {
							        "chat_id": {
									  S: chat_id
									}
							      },
							      TableName: 'chats',
							    };
							    db.deleteItem(params4, function(err4, data4) {
									if (err4) {
										callback(err4, null);
									} else {
										db.deleteItem(params_other, function(err_other, data_other) {
											if (err_other) {
												callback(err_other, null);
											} else {
												db.deleteItem(params_other1, function(err_other1, data_other1) {
													if (err_other1) {
														callback(err_other1, null);
													} else {
														callback(null, "Success");
													}
												});
											}
										});
									}
								});
							} else {
								var params5 = {
							      KeyConditions: {
							        chat_id: {
							          ComparisonOperator: 'EQ',
							          AttributeValueList: [ {S: chat_id} ]
							        },
							      },
							      TableName: "chat_users",
							    };
							    db.query(params5, function(err5, data5) {
									if (err5) {
										callback(err5, null);
									} else {
										// check for no items retrieved from query
										if (data5.Items.length == 0) {
											var params6 = {
										      Key: {
										        "chat_id": {
												  S: chat_id
												}
										      },
										      TableName: 'chats',
										    };
										    db.deleteItem(params6, function(err6, data6) {
												if (err6) {
													callback(err6, null);
												} else {
													callback(null, "Success");
												}
											});
										} else {
											callback(null, "Success");
										}
									}
								});
							}
						}
					});
				}
			})
		}
	});
    
}

var myDB_get_private_invites = function(user, callback) {
	console.log("Getting private invites for " + user);
	var params = {
      KeyConditions: {
        user: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: user} ]
        },
      },
      TableName: "chat_invites_new",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
	  callback(err, data);
    }
  });
}

var myDB_get_group_invites = function(user, callback) {
	console.log("Getting group invites for " + user);
	var params = {
      KeyConditions: {
        user: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: user} ]
        },
      },
      TableName: "group_chat_invites",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
	  callback(err, data);
    }
  });
}

// check for an invite from the user to the sender before allowing the invite to be sent by the sender (prevent mirror private invites)
// also checks to see if a chat between the users already exists, to prevent duplicate private chats
var myDB_check_for_invite = function(user, sender, callback) {
	console.log("Checking for invite between " + user + " and " + sender);
	var params = {
      KeyConditions: {
        user: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: sender} ]
        },
        sender: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: user} ]
        },
      },
      TableName: "chat_invites_new",
  };
  
	db.query(params, function(err, data) {
	    if (err) {
	      callback(err, null);
	    } else {
		  if (data.Items.length == 0) {
			// check for existing private chat
			myDB_check_chat(user, sender, function(err1, data1) {
				if (err1) {
					callback(err1, null);
				} else {
					callback(err1, data1);
				}
			});
		  } else {
			console.log("Invite between users found.");
			callback(err, data);
		}
	    }
    });
}

var myDB_check_for_chat = function(chat_id, callback) {
	console.log("Checking for chat: " + chat_id);
	var params = {
      KeyConditions: {
        chat_id: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: chat_id} ]
        }
      },
      TableName: "chats",
  };
	
	db.query(params, function (err, data) {
		if (err) {
			callback(err, null);
		} else {
			if (data.Items.length == 0) {
				callback(null, false);
			} else {
				callback(null, true);
			}
		}
	});
}

var myDB_get_outgoing_invites = function(user, callback) {
	console.log("Getting outgoing invites for " + user);
	var params = {
      KeyConditions: {
        sender: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: user} ]
        },
      },
      TableName: "outgoing_invites",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
	  callback(err, data);
    }
  });
}

// checks for a group invite to a specific chat_id to user, prevents multiple invites to the same chat by different senders
var myDB_check_for_group_invite = function(user, chat_id, callback) {
	var params = {
      KeyConditions: {
        user: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: user} ]
        },
        chat_id: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ {S: chat_id} ]
        }
      },
      TableName: "group_chat_invites",
  };

  db.query(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
	  if (data.Items.length === 0) {
		callback(null, false);
	}
	else {
		callback(null, true);
	}
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
  deleteGroupInvite: myDB_delete_group_invite,
  leaveChat: myDB_leave_chat,
  getPrivateInvites: myDB_get_private_invites,
  getGroupInvites: myDB_get_group_invites,
  checkForInvite: myDB_check_for_invite,
  checkForChat: myDB_check_for_chat,
  getOutgoingInvites: myDB_get_outgoing_invites,
  checkForGroupInvite: myDB_check_for_group_invite
};

module.exports = database;
















