const { application } = require('express');
var db = require('../models/news_database.js');

var getNewsKeywords = function(req, res) {
    let login = req.session.login;
    if (!login) {
        res.redirect('/');
    } else {
        // Split up words by spaces and get rid of any empty strings in case of extra whitespace
        console.log(req.query.keywords);
        var keywords = req.query.keywords.length > 0 && req.query.keywords.match(/^[A-Za-z ]+$/)
            ? req.query.keywords.split(" ").filter((word) => word !== "")
            : "";
        
        db.get_news_keywords(login, keywords, function(err, data) {
            res.send(data);
        });
    }
}

var routes = {
    get_news_keywords: getNewsKeywords,
};

module.exports = routes;
