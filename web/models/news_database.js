var AWS = require('aws-sdk');
const stemmer = require('stemmer');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();

/**
 * Queries for news feed
 */

// Gets a single news article that the user has not seen and returns it. Sets seen to true for this article
var getNewsArticles = function(login, callback) {
    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login } ]
            }
        },
        TableName: 'news_weights',
    };

    db.query(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            var todaysArticles = {};
            var today = new Date(Date.now() - 18000000);
            today.setUTCHours(0, 0, 0, 0);
            data.Items.forEach(function(article) {
                var articleDate = new Date(article.date.S);
                if (articleDate.getFullYear() == today.getFullYear() && articleDate.getMonth() == today.getMonth() && articleDate.getDate() == today.getDate()) {
                    todaysArticles[article.article_id.S] = article;
                }
            });

            if (!Object.keys(todaysArticles).length) {
                callback([]);
                return;
            }
            var seenPromises = [];

            Object.values(todaysArticles).forEach(function(article) {
                var params = {
                    KeyConditions: {
                        login: {
                            ComparisonOperator: 'EQ',
                            AttributeValueList: [ { S: login } ]
                        },
                        article_id: {
                            ComparisonOperator: 'EQ',
                            AttributeValueList: [ { S: article.article_id.S} ]
                        },
                    },
                    TableName: 'news_seen',
                    AttributesToGet: ['article_id'],
                };

                seenPromises.push(db.query(params).promise());
            });


            Promise.all(seenPromises).then(
                successData => {
                    successData.forEach(function(seenData) {
                        if (seenData.Count > 0) {
                            delete todaysArticles[seenData.Items[0].article_id.S];
                        }
                    });
                    var chosenIndex = weightedRandom(Object.values(todaysArticles));
                    setArticleSeen(login, Object.values(todaysArticles)[chosenIndex].article_id.S, function() {
                        callback([Object.values(todaysArticles)[chosenIndex]]);
                    });
                },
                error => {
                    console.log(error);
                }
            );
        }
    });
}

// Weighted random distribution choose: returns chosen index
function weightedRandom(articles) {
    var i;
    var cumWeights = [];

    for (i = 0; i < articles.length; i++) {
        cumWeights.push(articles[i].weight.N);
    }

    var random = Math.random() * cumWeights[cumWeights.length - 1];

    for (i = 0; i < cumWeights.length; i++) {
        if (random < cumWeights[i]) {
            return i;
        }
    }
}

var getNewsFeed = function(login, callback) {
    getNewsArticles(login, function(articles) {
        let promises = [];
        articles.forEach(article => {
            var params = {
                Key: {
                    'article_id': { S: article.article_id.S }
                },
                TableName: 'news',
            };
            promises.push(db.getItem(params).promise());
        });
        Promise.all(promises).then(
            successData => {
                let newsFeed = [];
                successData.forEach(article => {
                    if (article.Item) {
                        newsFeed.push(article.Item);
                    }
                });
                callback(newsFeed);
            }
        ).catch(
            errorData => {
                console.log(errorData);
            }
        );
    });
}


var getNewsKeywords = function(login, keywords, callback) {
    var today = new Date(Date.now());
    today.setUTCHours(0, 0, 0, 0);

    var kwdPromises = [];
    // Loop to handle multiple keywords for EC2
    for (var word of keywords) {
        // Params to find one of the words
        var params = {
             TableName: "news_keywords",
             KeyConditionExpression: "keyword = :keyword",
             ExpressionAttributeValues: {
                ":keyword": { S: stemmer(word).toLowerCase() },
             }
        };

        // Add query to promises array
        kwdPromises.push(db.query(params).promise())
    }

    Promise.all(kwdPromises).then(
        kwdResArr => {
            var articleMatches = kwdResArr
                .reduce((prev, cur) => prev.concat(cur.Items), []) // flatten the resArr
                .filter(res => new Date(res.date.S) <= today) // keep only articles from today or earlier
                .map(res => res.article_id.S) // keep only talk_ids
                .reduce(function(prev, cur) {
                    if (prev[cur])
                        prev[cur]++;
                    else
                        prev[cur] = 1;
                    return prev;
                }, {}); // convert to hashmap that maps id to number of matches to later sort results

            var params = {
                TableName: "news_weights",
                KeyConditionExpression: "login = :login",
                ExpressionAttributeValues: {
                    ":login": { S: login },
                }
            }
            db.query(params, function(err, wtRes) {
                if (err) {
                    callback(err, null);
                }

                var wtMap = {};
                for (var entry of wtRes.Items) {
                    wtMap[entry.article_id.S] = parseFloat(entry.weight.N);
                }
                // console.log(wtMap);
                
                var topMatches = Object.keys(articleMatches)
                    .sort(function(l, r) {
                        if (articleMatches[r] > articleMatches[l])
                            return 1;
                        else if (articleMatches[r] === articleMatches[l])
                            return (wtMap[r] ? wtMap[r] : 0) - (wtMap[l] ? wtMap[l] : 0);
                        else
                            return -1;
                    }); // sort first on number of matching keywords, then weights, descending
                topMatches = topMatches.slice(0, Math.min(15, topMatches.length)); // keep only top 15 results

                // Return full article information of matches
                var artPromises = [];
                for (var match of topMatches) {
                    // Params to find one of the words
                    var params = {
                         TableName: "news",
                         KeyConditionExpression: "article_id = :article_id",
                         ExpressionAttributeValues: {
                            ":article_id": { S: match },
                         }
                    };

                    // Add query to promises array
                    artPromises.push(db.query(params).promise())
                }

                Promise.all(artPromises).then(
                    artResArr => {
                        callback(null, artResArr.map(res => res.Items[0]))
                    },
                    artErr => {
                        console.log(artErr.message)
                    }
                )

            })
        },
        kwdErr => {
            console.log(kwdErr.message);
        }
    );
}

// Like a news article
var likeNewsArticle = function(login, article_id, callback) {
    var params = {
        Item: {
            login: { S: login },
            article_id: { S: article_id },
        },
        TableName: 'likes',
    };

    db.putItem(params, function(err, data) { 
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}

var unlikeNewsArticle = function(login, article_id, callback) {
    var params = {
        Key: {
            'login': { S: login },
            'article_id': { S: article_id }
        },
        TableName: 'likes'
    };

    db.deleteItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}

var setArticleSeen = function(login, article_id, callback) {
    var params = {
        Item: {
            login: { S: login },
            article_id: { S: article_id },
        },
        TableName: 'news_seen',
    };

    db.putItem(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            callback();
        }
    });
}

var getArticleSeen = function(login, article_id, callback) {
    var params = {
        KeyConditions: {
            login: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: login } ]
            },
            article_id: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [ { S: article_id} ]
            },
        },
        TableName: 'news_seen',
        AttributesToGet: ['article_id'],
    };
    
    db.query(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log(data);
            callback(data.Items);
        }
    });
}


var news_database = {
    get_news_keywords: getNewsKeywords,
    get_news_feed: getNewsFeed,
    get_news_articles: getNewsArticles,
    like_news_article: likeNewsArticle,
    unlike_news_article: unlikeNewsArticle,
    set_article_seen: setArticleSeen,
    get_article_seen: getArticleSeen,
};

module.exports = news_database;
