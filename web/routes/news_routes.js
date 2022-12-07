const { application } = require('express');
const { like_news_article } = require('../models/news_database.js');
var db = require('../models/news_database.js');

/**
 * Routes for news feed
 */

 var getNewsFeed = function(req, res) {
    let login = req.session.login;
    if (!login) {
        res.redirect('/');
    } else if (req.query.keywords) {
        console.log("News search: " + req.query.keywords);
        var keywords = req.query.keywords.length > 0 && req.query.keywords.match(/^[A-Za-z ]+$/)
            ? req.query.keywords.split(" ").filter((word) => word !== "")
            : "";
        
        db.get_news_keywords(login, keywords, function(err, data) {
            res.render('newsFeed.ejs', {news: data, login: login});
        });
    } else {
        db.get_news_feed(login, function(data) {
            res.render('newsFeed.ejs', {news: data, login: login});
        });
    }
}

var searchArticles = function(req, res) {
    let login = req.session.login;
    if (!login) {
        res.redirect('/');
    } else {
        res.redirect('/newsfeed?keywords=' + encodeURIComponent(req.body.keywords));
    }
}

var likeNewsArticle = function(req, res) {
    let login = req.session.login;
    db.like_news_article(login, req.body.article_id, function() {
        res.send({result: 0});
    });
}

var unlikeNewsArticle = function(req, res) {
    let login = req.session.login;
    db.unlike_news_article(login, req.body.article_id, function() {
        res.send({result: 0});
    });
}

var routes = {
    get_news_feed: getNewsFeed,
    search_articles: searchArticles,
    like_news_article: likeNewsArticle,
    unlike_news_article: unlikeNewsArticle
};

module.exports = routes;
