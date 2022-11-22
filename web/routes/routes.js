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

const categories = ["Crime", "Entertainment", "World News", "Impact", "Politics", "Weird News", "Black Voices",
                    "Women", "Comedy", "Queer Voices", "Sports", "Business", "Travel", "Media", "Tech", "Religion",
                    "Science", "Latino Voices", "Education", "College", "Parents", "Arts & Culture", "Style",
                    "Green", "Taste", "Healthy Living", "The Worldpost", "Good News", "Worldpost", "Fifty", "Arts",
                    "Wellness", "Parenting", "Home & Living", "Style & Beauty", "Divorce", "Weddings", "Food & Drink",
                    "Money", "Environment", "Culture & Arts"];
// Signup page
var signup = function(req, res) {
    var error = req.query.error ? req.query.error: "";
    res.render('signup.ejs', { error: error, categories: categories});
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
    var selected = req.body.categories;
    
    if (selected == null || selected.count < 2 || typeof selected === 'string') {
      res.redirect('/signup?error=' + encodeURIComponent('categories_selected'));
    } else {
      db.exists_user(login, function(err, data) {
          if (err) {
              console.log(err);
          } else if (data) {
              res.redirect('/signup?error=' + encodeURIComponent('invalid_username'));
          } else {
              db.add_user(login, password, firstname, lastname, email, affiliation, birthday, selected, function() {
                  req.session.login = login;
                  console.log('User ' + login + ' logged in.');
                  res.redirect('/homepage');
              });
          }
      });
    }
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
        db.get_friends_info(login, function(friends) {
            var info = data.Items[0]
            res.render('profile.ejs', {
                login: info.login.S,
                firstname: info.firstname.S,
                lastname: info.lastname.S,
                email: info.email.S,
                affiliation: info.affiliation.S,
                birthday: info.birthday.S,
                interests: info.interests.SS,
                curr_user: req.session.login,
                friends: friends,
            });
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

var changeAffiliation = function(req, res) {
    var login = req.session.login;
    var affiliation = req.body.affiliation; // TODO: implement as form in profile

    db.change_affiliation(login, affiliation, function() {res.redirect("/profile")}); // TODO: make status update
}

var changeEmail = function(req, res) {
    var login = req.session.login;
    var email = req.body.email; // TODO: implement as form in profile

    db.change_email(login, email, function() {res.redirect("/profile")}); 
}

var changePassword = function(req, res) {
    var login = req.session.login;
    var password = req.body.password; // TODO: implement as form in profile

    db.change_password(login, password, function() {res.redirect("/profile")});
}

var changeInterests = function(req, res) {
    var login = req.session.login;
    var interests = req.body.interests; // TODO: implement as form in profile

    db.change_interests(login, interests, function() {res.redirect("/profile")}); // TODO: make status update
}


/**
 * Routes for wall
 */

var getWall = function(req, res) {
    let login = req.params.login;
    db.get_friends(login, function(data) {
        data.push(login);
        db.get_posts(data, function(posts) {
            posts.sort((one, two) => { return new Date(two.timestamp.S) - new Date(one.timestamp.S) });
            res.render('wall.ejs', {posts: posts, login: login});
        });
    });
}

var makePost = function(req, res) {
    let user = req.session.login;
    let login = req.body.login;
    if (!user) {
        res.redirect('/');
    } else {
        if (user == login) {
            db.add_post(user, req.body.message, new Date().toJSON(), function(data) {
                res.send({success: true, data: data});
            });
        } else {
            db.verify_friends(user, login, function(data) {
                if (data.Count > 0) {
                    db.add_post(user, req.body.message, new Date().toJSON(), function(data) {
                        res.send({success: true, data: data});
                    });
                } else {
                    res.send({success: false});
                }
            });
        }
    }
}

var makeComment = function(req, res) {
    let user = req.session.login;
    if (!user) {
        res.redirect('/');
    } else {
        db.add_comment(user, req.body.post_id, req.body.message, function(data) {
            res.send({success: true, data: data});
        });
    }
}

/**
 * Routes for homepage
 */

var getHomepage = function(req, res) {
    if (!req.session.login) {
        res.redirect('/');
    } else {
        res.render('homepage.ejs');
    }
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
    change_affiliation: changeAffiliation,
    change_email: changeEmail,
    change_password: changePassword,
    change_interests: changeInterests,
    search_JSON: searchJSON,
    make_post: makePost,
    make_comment: makeComment,
};

module.exports = routes;