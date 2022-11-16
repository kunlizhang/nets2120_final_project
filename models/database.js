var AWS = require('aws-sdk');
const { createHash } = require('crypto');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();

/*
    Helper functions
*/

function hash(string) {
    return createHash('sha256').update(string).digest('hex');
}

/*
    USER database functions
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
            'email': { S : email },
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
            'name_c': { S: firstname.charAt(0)},
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

var database = {
    add_user: addUser,
    exists_user: existsUser,
    verify_user: verifyUser,
};

module.exports = database;