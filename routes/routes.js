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
    var login = req.body.username;
    var password = req.body.password;

    db.verify_user(username, password, function(err, data) {
        if (err) {
            console.log(err);
            res.redirect('/?error=' + encodeuricomponent("invalid_login"));
        } else {
            if (data) {
                console.log("User " + login + " logged in.");
                // TODO implement homepage here
                res.redirect('/')
            } else {
                res.redirect('/?error=' + encodeuricomponent("invalid_login"));
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

}

var routes = {
    get_main: getMain,
    check_login: checkLogin,
    signup: signup,
    create_account: createAccount,
};

module.exports = routes;