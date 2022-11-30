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

// Checks login is valid. Also updates the online table to indicate that they are online
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
                db.check_user_online(login, function(err, data) {
                    if (err) {
                        console.log(err);
                    } else {
                        if (data) {
                            db.update_user_online(login, new Date().toJSON(), function(err, data) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log("User " + login + " is now online.");
                                }
                            });
                        } else {
                            db.add_user_online(login,new Date().toJSON(), function(err, data) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log("User " + login + " is now online.");
                                }
                            });
                        }
                        req.session.login = login;
                        res.redirect('/homepage') 
                    }
                });
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
    if (req.session.login) {
        res.redirect('/homepage');
    } else {
        var error = req.query.error ? req.query.error: "";
        res.render('signup.ejs', { error: error, categories: categories});
    }
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
                  res.redirect('/');
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
    db.delete_user_online(req.session.login, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log("User " + req.session.login + " is now offline.");
            req.session.login = "";
            res.redirect('/');
        }
    });
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
    if (!req.session.login) {
        res.redirect('/');
    } else {
        var login = req.params.login;
        db.get_user_info(login, function(data) {
            db.get_friends_info(login, function(friends) {
                var info = data.Items[0];
                var postNames = friends.map(elem => elem.friend_login.S);
                postNames.push(login);
                db.get_posts(postNames, function(posts) {
                    posts.sort((one, two) => { return new Date(two.timestamp.S) - new Date(one.timestamp.S) }); // change later
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
                        posts: posts,
                    });
                });
            });
        });
    }
}

var getFriends = function(req, res) {
    var login = req.body.login;
    db.get_friends_info(login, function(friends) {
        res.send({friends: friends.map(elem => elem.friend_login.S)});
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

    db.add_friend(login1, login2, new Date().toJSON(), function() {res.send({})});
}

var deleteFriends = function(req, res) {
    var login1 = req.body.login1;
    var login2 = req.body.login2;

    db.delete_friend(login1, login2, function() {res.send({})});
}

var changeAffiliation = function(req, res) {
    var login = req.session.login;
    var affiliation = req.body.affiliation; 

    db.change_affiliation(login, affiliation, function() {
        db.add_post(login, login + " changed their affiliation to " + affiliation, new Date().toJSON(), function() {
            res.redirect("/profile")
        });
    }); 
}

var changeEmail = function(req, res) {
    var login = req.session.login;
    var email = req.body.email; 

    db.change_email(login, email, function() {res.redirect("/profile")}); 
}

var changePassword = function(req, res) {
    var login = req.session.login;
    var password = req.body.password; 

    db.change_password(login, password, function() {res.redirect("/profile")});
}

var changeInterests = function(req, res) {
    var login = req.session.login;
    var interests = req.body.interests; 

    var old_interests;

    db.get_user_info(login, function(data) {
        old_interests = data.Items[0].interests.SS;
        db.change_interests(login, interests, function() {
            for (var new_interest of interests) {
                if (old_interests.indexOf(new_interest) == -1) {
                    db.add_post(login, login + " added " + new_interest + " to their interests", new Date().toJSON(), function() {});
                }
            }
            res.redirect("/profile");
        });
    }); 
}



/**
 * Routes for wall
 */
var getPosts = function(req, res) {
    var login = req.body.login;
    if (login == null || login == "") {
        res.send({posts: []});
    } else {
        db.get_friends_info(login, function(friends) {
            var postNames = friends.map(elem => elem.friend_login.S);
            postNames.push(login);
            db.get_posts(postNames, function(posts) {
                posts.sort((one, two) => { return new Date(two.timestamp.S) - new Date(one.timestamp.S) }); // change later
                res.send({posts: posts});
            });
        });
    }
}

var makePost = function(req, res) {
    let user = req.session.login;
    let login = req.body.login;
    if (!user) {
        res.redirect('/');
    } else {
        let message = req.body.message.trim();
        if (message == null || message == "") {
            res.send({result: 2});
        } else {
            if (user == login) {
                db.add_post(user, message, new Date().toJSON(), function(post) {
                    res.send({result: 0, data: post});
                });
            } else {
                db.verify_friends(user, login, function(data) {
                    if (data.Count > 0) {
                        db.add_post(user, message, new Date().toJSON(), function(post) {
                            res.send({result: 0, data: post});
                        });
                    } else {
                        res.send({result: 1});
                    }
                });
            }
        }
    }
}

var makeComment = function(req, res) {
    let user = req.session.login;
    if (!user) {
        res.redirect('/');
    } else {
        let comment = req.body.message.trim();
        if (comment == null || comment == "") {
            res.send({result: 2});
        } else {
            db.add_comment(req.body.post_user, user, req.body.post_id, comment, function(data) {
                res.send({result: 0, data: data});
            });
        }
    }
}

/**
 * Routes for homepage
 */

var getHomepage = function(req, res) {
    let login = req.session.login;
    if (!login) {
        res.redirect('/');
    } else {
        db.get_friends_info(login, function(friends) {
            var postNames = friends.map(elem => elem.friend_login.S);
            postNames.push(login);
            db.get_posts(postNames, function(posts) {
                let events = posts.concat(friends);
                events.sort((one, two) => { return new Date(two.timestamp.S) - new Date(one.timestamp.S) }); // change later
                res.render('homepage.ejs', {
                    login: login,
                    posts: events,
                });
            });
        });
    }
}

var routes = {
    get_main: getMain,
    check_login: checkLogin,
    signup: signup,
    create_account: createAccount,
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
    get_posts: getPosts,
    get_friends: getFriends,
};

module.exports = routes;