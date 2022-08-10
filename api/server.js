#!/usr/bin/node

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser'); //google auth uses this
const bodyParser = require('body-parser');
const passport = require('passport');
const cors = require('cors');
const nocache = require('nocache');

const config = require('./config');
const db = require('./models');

//prevent startup if config is old
if(config.auth.default_scopes) {
    throw new Error("default_scopes is replaced by default object in config.");
}

const app = express();
app.use(cors());
app.use(nocache());
app.use(bodyParser.json()); //parse application/json
app.use(bodyParser.urlencoded({extended: false})); //parse application/x-www-form-urlencoded //TODO - do we need this?
app.use(cookieParser());
app.use(passport.initialize());//needed for express-based application

app.use('/', require('./controllers'));

//error handling
app.use(function(err, req, res, next) {
    if(typeof err == "string") err = {message: err};

    if(!err.name || err.name != "UnauthorizedError") {
        console.error(err);
    }

    if(err.stack) err.stack = "hidden"; //don't sent call stack to UI - for security reason
    res.status(err.status || 500);
    res.json(err);

    console.error(err);
});

process.on('uncaughtException', function (err) {
    //TODO report this to somewhere!
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack)
})

exports.app = app;
exports.start = function(cb) {
    db.mongo.connection.then(()=>{
        console.debug("db connected");
        var port = process.env.PORT || config.express.port || '8080';
        var host = process.env.HOST || config.express.host || 'localhost';
        app.listen(port, host, function(err) {
            if(err) return cb(err);
            console.log("Express server listening on %s:%d", host,port);
            cb(null);
        });
    });
}


