const { application } = require('express');
var db = require('../models/database.js');

var getMain = function(req, res) {
    var error = req.query.error ? req.query.error: "";
    res.render('login.ejs', {error: error});
}

var routes = {
    get_main: getMain,
};

module.exports = routes;