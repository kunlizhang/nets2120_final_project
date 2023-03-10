var AWS = require('aws-sdk');
const { createHash } = require('crypto');
const { brotliDecompress } = require('zlib');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
const {v4: uuidv4} = require('uuid');

/**
 * Helper functions
*/

function hash(string) {
    return createHash('sha256').update(string).digest('hex');
}

/**
 * USER database functions
*/

// Adds a user to user and also add to user_search
var addUser = function(login, password, firstname, lastname, email, affiliation, birthday, interests, callback) {
    console.log("Adding user: " + login);

    var params = {
        Item: {
            'login': { S: login },
            'password': { S: hash(password) },
            'firstname': { S: firstname },
            'lastname': { S: lastname },
            'email': { S: email },
            'affiliation': { S: affiliation },
            'birthday': { S: birthday },
            'interests': { SS: interests }
        },
        TableName: "user",
        ReturnValues: 'NONE'
    };

    db.putItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            addUserSearch(login, firstname, lastname, callback);
        }
    })
} 

// Adds a user to the search table. Called by addUser.
var addUserSearch = function(login, firstname, lastname, callback) {
    var puts = [];
    var fullname = firstname + ' ' + lastname;

    for (var i = 1; i <= fullname.length; i++) {
        var keyword = fullname.substring(0, i).toLowerCase();

        var params = {
            Item: {
                'substring': { S: keyword},
                'login': { S: login},
                'fullname': { S: fullname},
            },
            TableName: "user_search",
            ReturnValues: 'NONE'
        };

        puts.push(db.putItem(params).promise());
    }

    Promise.all(puts).then(function() {
        callback();
    });
}

// Verifies if a given login password combination is correct
var verifyUser = function(login, password, callback) {
    console.log("Verifying user: " + login);

    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login } ]
            }
        },
        TableName: "user",
        AttributesToGet: ['password']
    };

    db.query(params, function(err, data) {
        if (err || data.Items.length == 0) {
            callback(err, false);
        } else if (data.Items[0].password.S === hash(password)) {
            callback(err, true);
        } else {
            callback(err, false);
        }
    });
}

// Checks if the login is already used.
// True is passed to the callback if it is
var existsUser = function(login, callback) {
    console.log("Verifying user exists: " + login);

    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login } ]
            }
        },
        TableName: 'user',
        AttributesToGet: ['login']
    };

    db.query(params, function(err, data) {
        if (err || data.Items.length == 0) {
            callback(err, false);
        } else {
            callback(err, true);
        }
    });
}

// Get user info
var getUserInfo = function(login, callback) {
    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login } ]
            }
        },
        TableName: 'user',
        AttributesToGet: ['login', 'firstname', 'lastname', 'email', 'affiliation', 'birthday', 'interests']
    };

    db.query(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback(data);
        }
    });
}

// Search users
var searchUser = function(keyword, callback) {
    var params = {
        KeyConditions: {
            substring: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: keyword} ]
            }
        },
        TableName: 'user_search',
        AttributesToGet: ['fullname', 'login']
    };
    
    db.query(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback(data);
        }
    });
}

var changeEmail = function(login, email, callback) {
    var params = {
        Key: {
            'login': { S: login }
        },
        TableName: 'user',
        UpdateExpression: 'set email = :e',
        ExpressionAttributeValues: {
            ':e': { S: email }
        },
        ReturnValues: 'NONE'
    };

    db.updateItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}

var changePassword = function(login, password, callback) {
    var params = {
        Key: {
            'login': { S: login }
        },
        TableName: 'user',
        UpdateExpression: 'set password = :p',
        ExpressionAttributeValues: {
            ':p': { S: hash(password) }
        },
        ReturnValues: 'NONE'
    };

    db.updateItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}

var changeAffiliation = function(login, affiliation, callback) {
    var params = {
        Key: {
            'login': { S: login }
        },
        TableName: 'user',
        UpdateExpression: 'set affiliation = :a',
        ExpressionAttributeValues: {
            ':a': { S: affiliation }
        },
        ReturnValues: 'NONE'
    };
    
    db.updateItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}

var changeInterests = function(login, interests, callback) {
    var params = {
        Key: {
            'login': { S: login }
        },
        TableName: 'user',
        UpdateExpression: 'set interests = :i',
        ExpressionAttributeValues: {
            ':i': { SS: interests }
        },
        ReturnValues: 'NONE'
    };

    db.updateItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}


/**
 * FRIEND database queries
 */

var verifyFriends = function(login1, login2, callback) {
    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login1 } ]
            },
            friend_login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login2 } ]
            },
            
        },
        TableName: 'friend',
        AttributesToGet: ['login', 'friend_login'],
    };

    db.query(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback(data);
        }
    });
}

var addFriends = function(login1, login2, timestamp, callback) {
    var params = {
        Item: {
            'login': { S: login1 },
            'friend_login': { S: login2 },
            'timestamp': { S: timestamp },
        },
        TableName: 'friend',
        ReturnValues: 'NONE'
    };

    db.putItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            var params = {
                Item: {
                    'login': { S: login2 },
                    'friend_login': { S: login1 },
                    'timestamp': { S: timestamp },
                },
                TableName: 'friend',
                ReturnValues: 'NONE'
            }; 

            db.putItem(params, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    callback();
                }
            })
        }
    })
}

var deleteFriends = function(login1, login2, callback) {
    var params = {
        Key: {
            'login': { S: login1 },
            'friend_login': { S: login2 },
        },
        TableName: 'friend'
    }

    db.deleteItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            var params = {
                Key: {
                    'login': { S: login2 },
                    'friend_login': { S: login1 },
                },
                TableName: 'friend'
            }

            db.deleteItem(params, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    callback();
                }
            });
        }
    });
}

var getFriendsInfo = function(login, callback) {
    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login } ]
            },
            
        },
        TableName: 'friend',
    };
  
    db.query(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback(data.Items);
        }
    });
}

/**
 * Wall posting database queries
 */

var getPosts = function(users, callback) {
    let promises = [];
    users.forEach(user => {
        const promise = new Promise((resolve, reject) => {
            var params = {
                KeyConditions: {
                    login: {
                        ComparisonOperator: 'EQ',
                        AttributeValueList: [ { S: user } ]
                    },
                    
                },
                TableName: 'posts',
            };
          
            db.query(params, function(err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(data.Items);
                }
            });
        });
        promises.push(promise);
    });
    Promise.all(promises).then(
        successData => {
            callback([].concat.apply([], successData));
        }
    ).catch(
        errorData => {
            console.log(errorData);
        }
    );
}

var addPost = function(login, message, timestamp, callback) {
    let id = uuidv4().toString();
    var params = {
        Item: {
            'login': { S: login },
            'post_id': { S: hash(id) },
            'comments': { SS: ["default"] },
            'message': { S: message },
            'timestamp': { S: timestamp },
        },
        TableName: "posts",
        ReturnValues: 'NONE'
    };
    
    db.putItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback(params.Item);
        }
    });
}

var addComment = function(post_user, login, post_id, message, callback) {
    let value = login.concat(", ", message);
    var params = {
        TableName: "posts",
        "Key": { 
          "login": { "S": post_user },
          "post_id": { "S": post_id },
       },
        UpdateExpression: 'ADD comments :comment',
        ExpressionAttributeValues: {
            ':comment': { 'SS': [value] }
        },
    };
    
    db.updateItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback(value);
        }
    });
}

// User online queries
var updateUserOnline = function(login, timestamp, callback) {
    var params = {
        Key: {
            'login': { S: login }
        },
        TableName: 'user_online',
    };
    
    db.getItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else if (data.Items) {
            var params = {
                TableName: "user_online",
                "Key": { 
                  "login": { "S": login },
                },
                UpdateExpression: 'SET last_active = :last_active',
                ExpressionAttributeValues: {
                    ':last_active': { 'S': timestamp }
                },
            };
            
            db.updateItem(params, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    callback();
                }
            });
        } else {
            var params = {
                Item: {
                    'login': { S: login },
                    'last_active': { S: timestamp },
                },
                TableName: 'user_online',
            };
        
            db.putItem(params, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    callback();
                }
            });
        }
    });
}

var deleteUserOnline = function(login, callback) {
    var params = {
        Key: {
            'login': { S: login }
        },
        TableName: 'user_online'
    };

    db.deleteItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}

var checkUserOnline = function(login, callback) {
    var params = {
        Key: {
            'login': { S: login }
        },
        TableName: 'user_online',
    };
    
    db.getItem(params, function(err, data) {
        callback(err, data.Item);
    });
}

var getOnlineFriends = function(login, callback) {
    console.log("Getting online friends for " + login);
    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login } ]
            },
            
        },
        TableName: 'friend',
    };
  
    db.query(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            let friends = data.Items;
            let promises = [];
            friends.forEach(friend => {
                var params = {
                    Key: {
                        'login': { S: friend.friend_login.S }
                    },
                    TableName: 'user_online',
                };
                promises.push(db.getItem(params).promise());
            });
            Promise.all(promises).then(
                successData => {
                    let onlineFriends = [];
                    successData.forEach(friend => {
                        if (friend.Item) {
                            var time = new Date(friend.Item.last_active.S);
                            var now = new Date();
                            var diff = (now - time) / 1000;
                            if (diff < 600) {
                                onlineFriends.push(friend.Item.login.S);
                            }
                        }
                    });
                    callback(onlineFriends);
                }
            ).catch(
                errorData => {
                    console.log(errorData);
                }
            );
        }
    });
}

var database = {
    add_user: addUser,
    exists_user: existsUser,
    verify_user: verifyUser,
    get_user_info: getUserInfo,
    search_user: searchUser,
    change_affiliation: changeAffiliation,
    change_password: changePassword,
    change_email: changeEmail,
    change_interests: changeInterests,
    verify_friends: verifyFriends,
    add_friend: addFriends,
    delete_friend: deleteFriends,
    get_friends_info: getFriendsInfo,
    get_posts: getPosts,
    add_post: addPost,
    add_comment: addComment,
    update_user_online: updateUserOnline,
    check_user_online: checkUserOnline,
    delete_user_online: deleteUserOnline,
    get_online_friends: getOnlineFriends,
};

module.exports = database;
