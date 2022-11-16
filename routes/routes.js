const { application } = require('express');
var db = require('../models/database.js');

/**
 * Routes for login and user
*/

// Login page: the main page of the website
var getMain = function(req, res) {
    var error = req.query.error ? req.query.error: "";
    res.render('login.ejs', {error: error});
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
                res.redirect('/wall')
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
                res.redirect('/wall'); 
            });
        }
    });
}

/**
 * Routes for wall
 */

var getWall = function(req, res) {
    res.render('wall.ejs');
}

var routes = {
    get_main: getMain,
    check_login: checkLogin,
    signup: signup,
    create_account: createAccount,
    get_wall: getWall,
};

module.exports = routes;