#!/usr/bin/node

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser'); //google auth uses this
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const passport = require('passport');
const winston = require('winston');
const expressWinston = require('express-winston');
const cors = require('cors');

const config = require('./config');
const logger = new winston.Logger(config.logger.winston);
const db = require('./models');
const migration = require('./migration');

//prevent startup if config is old
if(config.auth.default_scopes) {
    throw new Error("default_scopes is replaced by default object in config.");
}

//init express
var app = express();
app.use(bodyParser.json()); //parse application/json
app.use(bodyParser.urlencoded({extended: false})); //parse application/x-www-form-urlencoded //TODO - do we need this?
app.use(expressWinston.logger(config.logger.winston)); 
app.use(cookieParser());
app.use(passport.initialize());//needed for express-based application

app.use(cors());
//app.options('*', cors()); //enable pre-flight across the board
/*
app.all('*', (req, res, next)=>{
    console.log("handling options");
    console.log(req.headers);
    res.header('Access-Control-Allow-Origin', 'https://soichi7.ppa.iu.edu');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'authorization,cache-control,if-modified-since,pragma');
    next();
});
*/
app.use('/', require('./controllers'));

//error handling
app.use(expressWinston.errorLogger(config.logger.winston));
app.use(function(err, req, res, next) {
    if(typeof err == "string") err = {message: err};
    //log this error
    logger.info(err);
    if(err.name) switch(err.name) {
    case "UnauthorizedError":
        logger.info(req.headers); //dump headers for debugging purpose..
        break;
    }
    if(err.stack) err.stack = "hidden"; //don't sent call stack to UI - for security reason
    res.status(err.status || 500);
    res.json(err);
});

process.on('uncaughtException', function (err) {
    //TODO report this to somewhere!
    logger.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    logger.error(err.stack)
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


