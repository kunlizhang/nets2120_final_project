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
    var params = {
        Item: {
            'name_c': { S: firstname.charAt(0).toLowerCase()},
            'fullname': { S: firstname.toLowerCase() + " " + lastname.toLowerCase()},
            'login': { S: login}
        },
        TableName: "user_search",
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
            name_c: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: keyword.charAt(0)} ]
            },
            fullname: {
                ComparisonOperator: 'BEGINS_WITH',
                AttributeValueList: [ { S: keyword } ]
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

var addFriends = function(login1, login2, callback) {
    var params = {
        Item: {
            'login': { S: login1 },
            'friend_login': { S: login2 }
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
                    'friend_login': { S: login1 }
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
            'friend_login': { S: login2} ,
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

var getFriends = function(login, callback) {
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
            callback(data.Items.map(elem => elem.friend_login.S));
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
        },
        errorData => {
            console.log(err);
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
            callback(data);
        }
    });
}

var addComment = function(login, post_id, message, callback) {
    let value = login.concat(", ", message);
    var params = {
        TableName: "posts",
        "Key": { 
          "login": { "S": login },
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
            callback(data);
        }
    });
}

var database = {
    add_user: addUser,
    exists_user: existsUser,
    verify_user: verifyUser,
    get_user_info: getUserInfo,
    search_user: searchUser,
    verify_friends: verifyFriends,
    add_friend: addFriends,
    delete_friend: deleteFriends,
    get_friends: getFriends,
    get_friends_info: getFriendsInfo,
    get_posts: getPosts,
    add_post: addPost,
    add_comment: addComment,

};

module.exports = database;