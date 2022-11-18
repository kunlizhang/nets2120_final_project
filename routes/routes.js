const { application } = require('express');
var db = require('../models/database.js');

/**
 * Routes for login and user
*/

// Login page: the main page of the website
var getMain = function(req, res) {
    var error = req.query.error ? req.query.error: "";
    if (req.session.login) {
        res.redirect('/homepage');
    } else {
        res.render('login.ejs', {error: error});
    }
}

// Checks login is valid
var checkLogin = function(req, res) {
    var login = req.body.login;
    var password = req.body.password;

    db.verify_user(login, password, function(err, data) {
        if (err) {
            console.log(err);
            res.redirect('/?error=' + encodeURIComponent("invalid_login"));
        } else {
            if (data) {
                console.log("User " + login + " logged in.");
                req.session.login = login;
                res.redirect('/homepage') 
            } else {
                res.redirect('/?error=' + encodeURIComponent("invalid_login"));
            } 
        }
    })
}

// Signup page
var signup = function(req, res) {
    var error = req.query.error ? req.query.error: "";
    res.render('signup.ejs', { error: error });
}

// Create an account
var createAccount = function(req, res) {
    var login = req.body.login;
    var password = req.body.password;
    var firstname = req.body.firstname;
    var lastname = req.body.lastname;
    var email = req.body.email;
    var affiliation = req.body.affiliation;
    var birthday = req.body.birthday;
    
    db.exists_user(login, function(err, data) {
        if (err) {
            console.log(err);
        } else if (data) {
            res.redirect('/signup?error=' + encodeURIComponent('invalid_username'));
        } else {
            db.add_user(login, password, firstname, lastname, email, affiliation, birthday, ['default'], function() {
                req.session.login = login;
                console.log('User ' + login + ' logged in.');
                res.redirect('/homepage');
            });
        }
    });
}


// Generates search page
var searchUser = function(req, res) {
    var keyword = req.params.keyword;

    db.search_user(keyword, function(data) {
        res.render('searchUsers.ejs', {users: data.Items});
    });
}

var searchUserRedirect = function(req, res) {
    var keyword = req.body.keyword.toLowerCase();

    res.redirect('/search/' + encodeURIComponent(keyword));
}

var searchJSON = function(req, res) {
    var keyword = req.body.keyword.toLowerCase();

    db.search_user(keyword, function(data) {
        res.send(data.Items);
    })
}

// Logout the user
var logoutUser = function(req, res) {
    req.session.login = "";
    res.redirect('/');
}

/**
 * Routes for profile
 */

// For handling /profile
var getMyProfile = function(req, res) {
    if (!req.session.login) {
        res.redirect('/');
    } else {
        res.redirect('/profile/' + req.session.login);
    }
}

// Generates profile page
var getProfile = function(req, res) {
    var login = req.params.login;
    db.get_user_info(login, function(data) {
        var info = data.Items[0]
        res.render('profile.ejs', {
            login: info.login.S,
            firstname: info.firstname.S,
            lastname: info.lastname.S,
            email: info.email.S,
            affiliation: info.affiliation.S,
            birthday: info.birthday.S,
            curr_user: req.session.login,
        });
    });
}

// Get friend status
var getFriendStatus = function(req, res) {
    var login1 = req.body.login1;
    var login2 = req.body.login2;

    db.verify_friends(login1, login2, function(data) {
        if (data.Count > 0) {
            res.send({friends: true});
        } else {
            res.send({friends: false});
        }
    })
}

var addFriends = function(req, res) {
    var login1 = req.body.login1;
    var login2 = req.body.login2; 

    db.add_friend(login1, login2, function() {res.send()});
}

var deleteFriends = function(req, res) {
    var login1 = req.body.login1;
    var login2 = req.body.login2;

    db.delete_friend(login1, login2, function() {res.send()});
}

/**
 * Routes for wall
 */

var getWall = function(req, res) {
    res.render('wall.ejs');
}

/**
 * Routes for homepage
 */

var getHomepage = function(req, res) {
    res.render('homepage.ejs');
}

var routes = {
    get_main: getMain,
    check_login: checkLogin,
    signup: signup,
    create_account: createAccount,
    get_wall: getWall,
    get_homepage: getHomepage,
    get_profile: getProfile,
    get_my_profile: getMyProfile,
    search_user_redirect: searchUserRedirect,
    search_user: searchUser,
    logout_user: logoutUser,
    get_friend_status: getFriendStatus,
    add_friend: addFriends,
    delete_friend: deleteFriends,
    search_JSON: searchJSON,
};

module.exports = routes;