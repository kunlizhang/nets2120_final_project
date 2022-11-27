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
					       "user_1": {
					          S: user_1
					        },
					        "user_2": {
							  S: user_2
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
					callback(null, id);
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

var myDB_add_user_chat = function(login, chat_id, callback) {
  console.log('Adding to: ' + login); 
  
  var params = {
      Item: {
       "login": {
          S: login
        },
        "chat_id": { 
          S: chat_id
        }
      },
      TableName: 'user_in_chat',
      ReturnValues: 'NONE'
  };

  db.putItem(params, function(err, data){
    if (err)
      callback(err);
    else
      callback(null, 'Success');
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

var database = { 
  createChat: myDB_create_chat,
  checkChat: myDB_check_chat,
  getMessages: myDB_get_messages,
  addMessage: myDB_add_message,
  addUserChat: myDB_add_user_chat,
  getUserChats: myDB_get_user_chats
};

module.exports = database;















