#!/usr/bin/node

//os
var fs = require('fs');
var path = require('path');

//contrib
var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var Sequelize = require('sequelize');
var passport = require('passport');
var winston = require('winston');
var expressWinston = require('express-winston');
var cors = require('cors');

//mine
var config = require('./config');
var logger = new winston.Logger(config.logger.winston);
var db = require('./models');
var migration = require('./migration');

//prevent startup if config is old
if(config.auth.default_scopes) {
    throw new Error("default_scopes is replaced by default object in config.");
}

//init express
var app = express();
app.use(cors());
app.use(bodyParser.json()); //parse application/json
app.use(bodyParser.urlencoded({extended: false})); //parse application/x-www-form-urlencoded //TODO - do we need this?
app.use(expressWinston.logger(config.logger.winston)); 
app.use(cookieParser()); //TODO - do we really need this?
app.use(passport.initialize());//needed for express-based application

app.use('/', require('./controllers'));

//error handling
app.use(expressWinston.errorLogger(config.logger.winston));
app.use(function(err, req, res, next) {
    if(typeof err == "string") err = {message: err};
    if(err.stack) {
        logger.info(err.stack);
        err.stack = "hidden"; //let's hide callstack
    }
    logger.info(err);
    res.status(err.status || 500);
    res.json(err);
});

process.on('uncaughtException', function (err) {
    //TODO report this to somewhere!
    logger.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    logger.error(err.stack)
    //process.exit(1); //some people think we should do this.. but I am not so sure..
})

exports.app = app;
exports.start = function(cb) {
    db.sequelize
    .sync(/*{force: true}*/)
    .then(migration.run)
    .then(function() {
        var port = process.env.PORT || config.express.port || '8080';
        var host = process.env.HOST || config.express.host || 'localhost';
        app.listen(port, host, function(err) {
            if(err) return cb(err);
            console.log("Express server listening on %s:%d", host,port);
            cb(null);
        });
    });
}


